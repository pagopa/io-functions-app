/**
 * An orchestrator to inizialize the subscriptions feed.
 *
 * When this orchestrator is run, the subscriptions data of the previous days get aggregated
 * and new "DAY 0" is created.
 *
 * All the steps are documented in the handler body.
 */

import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import * as df from "durable-functions";
import { IFunctionContext, Task } from "durable-functions/lib/src/classes";

import { SandboxFiscalCode } from "italia-ts-commons/lib/strings";

import { BlockedInboxOrChannelEnum } from "io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";
import { BlockedInboxOrChannels } from "io-functions-commons/dist/generated/definitions/BlockedInboxOrChannels";
import { ServiceId } from "io-functions-commons/dist/generated/definitions/ServiceId";

import { ActivityResult as GetProfilesLatestVersionActivityResult } from "../GetProfilesLatestVersionActivity/handler";
import { Input as UpdateSubscriptionsFeedActivityInput } from "../UpdateSubscriptionsFeedActivity/index";

const OrchestratorResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

const OrchestratorResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

const OrchestratorResult = t.taggedUnion("kind", [
  OrchestratorResultFailure,
  OrchestratorResultSuccess
]);

/**
 * Extracts the services that have inbox blocked
 */
export const getInboxBlockedServices = (
  blockedInboxOrChannels: BlockedInboxOrChannels
): ReadonlyArray<string> =>
  Object.keys(blockedInboxOrChannels).filter(service =>
    blockedInboxOrChannels[service].includes(BlockedInboxOrChannelEnum.INBOX)
  );

export const handler = function*(
  context: IFunctionContext
): IterableIterator<unknown> {
  const logPrefix = `InitSubscriptionsFeedOrchestrator`;

  const retryOptions = new df.RetryOptions(5000, 5);
  // tslint:disable-next-line: no-object-mutation
  retryOptions.backoffCoefficient = 1.5;

  // STEP 1: Get the latest version of each profile
  const getProfilesLatestVersionActivityResultJson = yield context.df.callActivity(
    "GetProfilesLatestVersionActivity"
  );

  // Decode the activity result
  const errorOrGetProfilesLatestVersionActivityResult = GetProfilesLatestVersionActivityResult.decode(
    getProfilesLatestVersionActivityResultJson
  );

  if (isLeft(errorOrGetProfilesLatestVersionActivityResult)) {
    return OrchestratorResult.decode({
      kind: "FAILURE",
      reason: `${logPrefix}|Can't decode GetProfilesLatestVersionActivity result`
    });
  }

  const getProfilesLatestVersionActivityResult =
    errorOrGetProfilesLatestVersionActivityResult.value;

  if (getProfilesLatestVersionActivityResult.kind === "FAILURE") {
    return OrchestratorResult.decode({
      kind: "FAILURE",
      reason: getProfilesLatestVersionActivityResult.reason
    });
  }

  const profilesLatestVersion =
    getProfilesLatestVersionActivityResult.value.profilesLatestVersion;

  // STEP 2: Create "fake" inputs for UpdateSubscriptionsFeedActivity

  // We collect activity tasks and then start all in parallel
  // tslint:disable-next-line: readonly-array
  const tasks: Task[] = [];

  for (const profile of Object.values(profilesLatestVersion)) {
    const { fiscalCode, version, blockedInboxOrChannels } = profile;

    // Skip development profiles
    if (SandboxFiscalCode.is(fiscalCode)) {
      continue;
    }

    // STEP 2.1: Create "PROFILE_SUBSCRIBED" fake input
    const profileSubscribedInput: UpdateSubscriptionsFeedActivityInput = {
      fiscalCode,
      operation: "SUBSCRIBED",
      subscriptionKind: "PROFILE",
      updatedAt: context.df.currentUtcDateTime.getTime(),
      version
    };

    // Add the "PROFILE_SUBSCRIBED" fake input to the tasks list
    tasks.push(
      context.df.callActivityWithRetry(
        "UpdateSubscriptionsFeedActivity",
        retryOptions,
        profileSubscribedInput
      )
    );

    // STEP 2.2: For each service with blocked inbox in the profile create a "SERVICE_UNSUBSCRIBED" fake input
    if (blockedInboxOrChannels !== undefined) {
      const blockedServices = getInboxBlockedServices(blockedInboxOrChannels);

      for (const s of blockedServices) {
        const serviceUnsubscribedInput: UpdateSubscriptionsFeedActivityInput = {
          fiscalCode,
          operation: "UNSUBSCRIBED",
          serviceId: s as ServiceId,
          subscriptionKind: "SERVICE",
          updatedAt: context.df.currentUtcDateTime.getTime(),
          version
        };

        // Add "SERVICE_UNSUBSCRIBED" fake input to the tasks list
        tasks.push(
          context.df.callActivityWithRetry(
            "UpdateSubscriptionsFeedActivity",
            retryOptions,
            serviceUnsubscribedInput
          )
        );
      }
    }
  }

  // Start all the tasks in parallel
  yield context.df.Task.all(tasks);

  return OrchestratorResultSuccess.encode({
    kind: "SUCCESS"
  });
};
