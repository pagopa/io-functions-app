import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import * as df from "durable-functions";
import { IFunctionContext } from "durable-functions/lib/src/classes";

import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { readableReport } from "italia-ts-commons/lib/reporters";

import { ServiceId } from "io-functions-commons/dist/generated/definitions/ServiceId";
import { RetrievedProfile } from "io-functions-commons/dist/src/models/profile";
import { Input as UpdateServiceSubscriptionFeedActivityInput } from "../UpdateSubscriptionsFeedActivity/index";
import { diffBlockedServices } from "../utils/profiles";

/**
 * Carries information about created or updated profile.
 *
 * When oldProfile is defined, the profile has been updated, or it has been
 * created otherwise.
 */
export const OrchestratorInput = t.intersection([
  t.interface({
    newProfile: RetrievedProfile,
    updatedAt: UTCISODateFromString
  }),
  t.partial({
    oldProfile: RetrievedProfile
  })
]);

export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

export const handler = function*(
  context: IFunctionContext
): IterableIterator<unknown> {
  const logPrefix = `UpsertedProfileOrchestrator`;

  const retryOptions = new df.RetryOptions(5000, 10);
  // tslint:disable-next-line: no-object-mutation
  retryOptions.backoffCoefficient = 1.5;

  // Get and decode orchestrator input
  const input = context.df.getInput();
  const errorOrUpsertedProfileOrchestratorInput = OrchestratorInput.decode(
    input
  );

  if (isLeft(errorOrUpsertedProfileOrchestratorInput)) {
    context.log.error(
      `${logPrefix}|Error decoding input|ERROR=${readableReport(
        errorOrUpsertedProfileOrchestratorInput.value
      )}`
    );
    return false;
  }

  const upsertedProfileOrchestratorInput =
    errorOrUpsertedProfileOrchestratorInput.value;

  const {
    newProfile,
    oldProfile,
    updatedAt
  } = upsertedProfileOrchestratorInput;

  const profileOperation = oldProfile !== undefined ? "UPDATED" : "CREATED";

  // Send welcome messages to the user
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
    yield context.df.callActivity("SendWelcomeMessagesActivity", {
      profile: newProfile
    });
  }

  // Update subscriptions feed
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
        updatedAt: updatedAt.getTime(),
        version: newProfile.version
      } as UpdateServiceSubscriptionFeedActivityInput
    );
  } else {
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
          updatedAt: updatedAt.getTime(),
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
          updatedAt: updatedAt.getTime(),
          version: newProfile.version
        } as UpdateServiceSubscriptionFeedActivityInput
      );
    }
  }

  return true;
};
