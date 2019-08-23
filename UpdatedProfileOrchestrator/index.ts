import * as df from "durable-functions";
import { IFunctionContext } from "durable-functions/lib/src/classes";

import { ReadableReporter } from "italia-ts-commons/lib/reporters";

import { UpdatedProfileEvent } from "../utils/UpdatedProfileEvent";

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

  const event = errorOrUpdatedProfileEvent.value;

  const logPrefix = `UpdatedProfileOrchestrator|PROFILE=${event.newProfile.fiscalCode}|VERSION=${event.newProfile.version}`;

  // if we have an old profile and a new one, the profile has been updated, or
  // else it has been created for the first time
  const operation = event.oldProfile !== undefined ? "UPDATED" : "CREATED";

  const isInboxEnabled = event.newProfile.isInboxEnabled === true;
  const isProfileCreated = operation === "CREATED";
  const hasOldProfileWithInboxDisabled =
    operation === "UPDATED" && event.oldProfile.isInboxEnabled === false;

  const hasJustEnabledInbox =
    isInboxEnabled && (isProfileCreated || hasOldProfileWithInboxDisabled);

  context.log.verbose(
    `${logPrefix}|OPERATION=${operation}|INBOX_ENABLED=${isInboxEnabled}|INBOX_JUST_ENABLED=${hasJustEnabledInbox}`
  );

  if (hasJustEnabledInbox) {
    yield context.df.callActivity("WelcomeMessagesActivity", {
      profile: event.newProfile
    });
  }

  return [];
};

const orchestrator = df.orchestrator(handler);

export default orchestrator;
