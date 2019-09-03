import * as df from "durable-functions";

import { IFunctionContext } from "durable-functions/lib/src/classes";

import { ReadableReporter } from "italia-ts-commons/lib/reporters";

import { ServiceId } from "io-functions-commons/dist/generated/definitions/ServiceId";

import { diffBlockedServices } from "../utils/profiles";
import { UpdatedProfileEvent } from "../utils/UpdatedProfileEvent";

import { Input as UpdateServiceSubscriptionFeedActivityInput } from "../UpdateSubscriptionsFeedActivity/index";

export const handler = function*(
  context: IFunctionContext
): IterableIterator<unknown> {
  const input = context.df.getInput();

  // decode input CreatedMessageEvent
  const errorOrUpdatedProfileEvent = UpdatedProfileEvent.decode(input);
  if (errorOrUpdatedProfileEvent.isLeft()) {
    context.log.error(
      `UpdatedProfileOrchestrator|Invalid UpdatedProfileEvent received|ORCHESTRATOR_ID=${
        context.df.instanceId
      }|ERRORS=${ReadableReporter.report(errorOrUpdatedProfileEvent).join(
        " / "
      )}`
    );
    // we will never be able to recover from this, so don't trigger a retry
    return [];
  }

  // TODO: customize + backoff
  // see https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-error-handling#javascript-functions-2x-only-1
  const retryOptions = new df.RetryOptions(5000, 10);

  const {
    newProfile,
    oldProfile,
    updatedAt
  } = errorOrUpdatedProfileEvent.value;

  const updatedAtIso = new Date(updatedAt).toISOString();

  const logPrefix = `UpdatedProfileOrchestrator|PROFILE=${newProfile.fiscalCode}|VERSION=${newProfile.version}|UPDATED_AT=${updatedAtIso}`;

  // if we have an old profile and a new one, the profile has been updated, or
  // else it has been created for the first time
  const profileOperation = oldProfile !== undefined ? "UPDATED" : "CREATED";

  //
  // Update the subscription feed
  //

  if (profileOperation === "CREATED") {
    // When a profile get created we add an entry to the profile subscriptions
    context.log.verbose(
      `${logPrefix}|Calling UpdateSubscriptionsFeedActivity|OPERATION=SUBSCRIBED`
    );
    yield context.df.callActivityWithRetry(
      "UpdateSubscriptionsFeedActivity",
      retryOptions,
      {
        fiscalCode: newProfile.fiscalCode,
        operation: "SUBSCRIBED",
        subscriptionKind: "PROFILE",
        updatedAt,
        version: newProfile.version
      } as UpdateServiceSubscriptionFeedActivityInput
    );
  } else if (profileOperation === "UPDATED") {
    // When the profile gets updates, we extract the services that have been
    // blocked and unblocked during this profile update.
    // Blocked services get mapped to unsubscribe events, while unblocked ones
    // get mapped to subscribe events.
    const {
      e1: unsubscribedServices,
      e2: subscribedServices
    } = diffBlockedServices(
      oldProfile.blockedInboxOrChannels,
      newProfile.blockedInboxOrChannels
    );

    for (const s of subscribedServices) {
      context.log.verbose(
        `${logPrefix}|Calling UpdateSubscriptionsFeedActivity|OPERATION=SUBSCRIBED|SERVICE_ID=${s}`
      );
      yield context.df.callActivityWithRetry(
        "UpdateSubscriptionsFeedActivity",
        retryOptions,
        {
          fiscalCode: newProfile.fiscalCode,
          operation: "SUBSCRIBED",
          serviceId: s as ServiceId,
          subscriptionKind: "SERVICE",
          updatedAt,
          version: newProfile.version
        } as UpdateServiceSubscriptionFeedActivityInput
      );
    }

    for (const s of unsubscribedServices) {
      context.log.verbose(
        `${logPrefix}|Calling UpdateSubscriptionsFeedActivity|OPERATION=UNSUBSCRIBED|SERVICE_ID=${s}`
      );
      yield context.df.callActivityWithRetry(
        "UpdateSubscriptionsFeedActivity",
        retryOptions,
        {
          fiscalCode: newProfile.fiscalCode,
          operation: "UNSUBSCRIBED",
          serviceId: s as ServiceId,
          subscriptionKind: "SERVICE",
          updatedAt,
          version: newProfile.version
        } as UpdateServiceSubscriptionFeedActivityInput
      );
    }
  }

  //
  // Send welcome messages
  //

  const isInboxEnabled = newProfile.isInboxEnabled === true;
  const hasOldProfileWithInboxDisabled =
    profileOperation === "UPDATED" && oldProfile.isInboxEnabled === false;

  const hasJustEnabledInbox =
    isInboxEnabled &&
    (profileOperation === "CREATED" || hasOldProfileWithInboxDisabled);

  context.log.verbose(
    `${logPrefix}|OPERATION=${profileOperation}|INBOX_ENABLED=${isInboxEnabled}|INBOX_JUST_ENABLED=${hasJustEnabledInbox}`
  );

  if (hasJustEnabledInbox) {
    yield context.df.callActivity("WelcomeMessagesActivity", {
      profile: newProfile
    });
  }

  return [];
};
