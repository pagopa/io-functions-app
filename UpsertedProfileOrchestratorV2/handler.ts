import * as t from "io-ts";

import { fromPredicate, isLeft } from "fp-ts/lib/Either";

import * as df from "durable-functions";
import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";

import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";

import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";

import {
  OrchestratorInput as EmailValidationProcessOrchestratorInput,
  OrchestratorResult as EmailValidationProcessOrchestratorResult
} from "../EmailValidationProcessOrchestrator/handler";
import { Input as UpdateServiceSubscriptionFeedActivityInput } from "../UpdateSubscriptionsFeedActivity/handler";
import { diffBlockedServices } from "../utils/profiles";

import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { NonEmptyArray } from "fp-ts/lib/NonEmptyArray";
import { EnqueueProfileCreationEventActivityInput } from "../EnqueueProfileCreationEventActivity/handler";
import {
  ActivityResult,
  ActivityResultSuccess
} from "../GetServicesPreferencesActivity/handler";
import { ActivityInput as SendWelcomeMessageActivityInput } from "../SendWelcomeMessagesActivity/handler";

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

export const getUpsertedProfileOrchestratorHandler = (params: {
  sendCashbackMessage: boolean;
  notifyOn?: NonEmptyArray<NonEmptyString>;
  // tslint:disable-next-line: no-big-function
}) =>
  // tslint:disable-next-line: no-big-function
  function*(context: IOrchestrationFunctionContext): Generator<unknown> {
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

    // Log the input
    context.log.verbose(
      `${logPrefix}|INPUT=${JSON.stringify(upsertedProfileOrchestratorInput)}`
    );

    const {
      newProfile,
      oldProfile,
      updatedAt
    } = upsertedProfileOrchestratorInput;

    const profileOperation = oldProfile !== undefined ? "UPDATED" : "CREATED";

    // Check if the profile email is changed
    const isProfileEmailChanged =
      profileOperation === "UPDATED" && newProfile.email !== oldProfile.email;
    if (isProfileEmailChanged) {
      try {
        const { fiscalCode, email } = newProfile;

        // Start a sub-orchestrator that handles the email validation process.
        // From the caller point it is like a normal activity.
        context.log.verbose(
          `${logPrefix}|Email changed, starting the email validation process`
        );
        const emailValidationProcessOrchestartorInput = EmailValidationProcessOrchestratorInput.encode(
          {
            email,
            fiscalCode
          }
        );

        const emailValidationProcessOrchestartorResultJson = yield context.df.callSubOrchestratorWithRetry(
          "EmailValidationProcessOrchestrator",
          retryOptions,
          emailValidationProcessOrchestartorInput
        );

        const errorOrEmailValidationProcessOrchestartorResult = EmailValidationProcessOrchestratorResult.decode(
          emailValidationProcessOrchestartorResultJson
        );

        if (isLeft(errorOrEmailValidationProcessOrchestartorResult)) {
          context.log.error(
            `${logPrefix}|Error decoding sub-orchestrator result|ERROR=${readableReport(
              errorOrEmailValidationProcessOrchestartorResult.value
            )}`
          );
        } else {
          const emailValidationProcessOrchestartorResult =
            errorOrEmailValidationProcessOrchestartorResult.value;

          if (emailValidationProcessOrchestartorResult.kind === "FAILURE") {
            context.log.error(
              `${logPrefix}|Sub-orchestrator error|ERROR=${emailValidationProcessOrchestartorResult.reason}`
            );
            return false;
          }

          context.log.verbose(
            `${logPrefix}|Email verification process completed sucessfully`
          );
        }
      } catch (e) {
        context.log.error(
          `${logPrefix}|Email verification process max retry exceeded|ERROR=${e}`
        );
      }
    }

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
      yield context.df.callActivityWithRetry(
        "SendWelcomeMessagesActivity",
        retryOptions,
        {
          messageKind: "WELCOME",
          profile: newProfile
        } as SendWelcomeMessageActivityInput
      );
      yield context.df.callActivityWithRetry(
        "SendWelcomeMessagesActivity",
        retryOptions,
        {
          messageKind: "HOWTO",
          profile: newProfile
        } as SendWelcomeMessageActivityInput
      );
      if (params.sendCashbackMessage) {
        yield context.df.callActivityWithRetry(
          "SendWelcomeMessagesActivity",
          retryOptions,
          {
            messageKind: "CASHBACK",
            profile: newProfile
          } as SendWelcomeMessageActivityInput
        );
      }
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
      const { newServicePreferencesMode, oldServicePreferenceMode } = {
        newServicePreferencesMode: newProfile.servicePreferencesSettings.mode,
        oldServicePreferenceMode: oldProfile.servicePreferencesSettings.mode
      };

      if (newServicePreferencesMode === ServicesPreferencesModeEnum.LEGACY) {
        // When a LEGACY profile gets updates, we extract the services that have been
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
        // we need to update Subscription Feed on Profile Upsert when:
        // Service Preference Mode has changed from oldProfile to newProfile in upsert operation
        // and mode transition causes an effective change (i.e when NOT going from LEGACY to AUTO)
      } else if (
        oldServicePreferenceMode !== newServicePreferencesMode &&
        (oldServicePreferenceMode !== ServicesPreferencesModeEnum.LEGACY ||
          newServicePreferencesMode !== ServicesPreferencesModeEnum.AUTO)
      ) {
        // | oldServicePreferenceMode | newServicePreferencesMode | Operation
        // -------------------------------------------------------------------------
        // | LEGACY                   | MANUAL                    | UNSUBSCRIBED
        // | AUTO                     | MANUAL                    | UNSUBSCRIBED
        // | MANUAL                   | AUTO                      | SUBSCRIBED
        // When a profile Service preference mode is upserted from AUTO or LEGACY to MANUAL
        // we must unsubscribe th entire profile, otherwise from MANUAL we can update mode only to AUTO
        // so we must subscribe the entire profile.
        const feedOperation =
          newServicePreferencesMode === ServicesPreferencesModeEnum.MANUAL
            ? "UNSUBSCRIBED"
            : "SUBSCRIBED";
        context.log.verbose(
          `${logPrefix}|Calling UpdateSubscriptionsFeedActivity|OPERATION=${feedOperation}`
        );

        // Only if previous mode is MANUAL or AUTO could exists services preferences.
        if (
          oldProfile.servicePreferencesSettings.mode !==
          ServicesPreferencesModeEnum.LEGACY
        ) {
          // Execute a new version of the orchestrator
          const activityResult = yield context.df.callActivityWithRetry(
            "GetServicesPreferencesActivity",
            retryOptions,
            {
              fiscalCode: oldProfile.fiscalCode,
              settingsVersion: oldProfile.servicePreferencesSettings.version
            }
          );
          const maybeServicesPreferences = ActivityResult.decode(activityResult)
            .mapLeft(_ => new Error(readableReport(_)))
            .chain(
              fromPredicate(
                (_): _ is ActivityResultSuccess => _.kind === "SUCCESS",
                _ => new Error(_.kind)
              )
            )
            .fold(
              err => {
                // Invalid Activity input. The orchestration fail
                context.log.error(
                  `${logPrefix}|GetServicesPreferencesActivity|ERROR=${err.message}`
                );
                throw err;
              },
              _ => _.preferences
            );
          yield context.df.callActivityWithRetry(
            "UpdateSubscriptionsFeedActivity",
            retryOptions,
            {
              fiscalCode: newProfile.fiscalCode,
              operation: feedOperation,
              previousPreferences: maybeServicesPreferences,
              subscriptionKind: "PROFILE",
              updatedAt: updatedAt.getTime(),
              version: newProfile.version
            } as UpdateServiceSubscriptionFeedActivityInput
          );
        } else {
          yield context.df.callActivityWithRetry(
            "UpdateSubscriptionsFeedActivity",
            retryOptions,
            {
              fiscalCode: newProfile.fiscalCode,
              operation: feedOperation,
              subscriptionKind: "PROFILE",
              updatedAt: updatedAt.getTime(),
              version: newProfile.version
            } as UpdateServiceSubscriptionFeedActivityInput
          );
        }
      }
    }

    // Create messages on specific queues when a user profile become enabled
    // Moved at the end to mitigate orchestrator versioning https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-versioning
    if (hasJustEnabledInbox && params.notifyOn) {
      try {
        yield context.df.Task.all(
          params.notifyOn.toArray().map(serviceQueueName =>
            context.df.callActivityWithRetry(
              "EnqueueProfileCreationEventActivity",
              retryOptions,
              EnqueueProfileCreationEventActivityInput.encode({
                fiscalCode: newProfile.fiscalCode,
                queueName: serviceQueueName
              })
            )
          )
        );
      } catch (e) {
        context.log.error(
          `${logPrefix}|Send Profile creation event max retry exeded|ERROR=${e}`
        );
      }
    }

    return true;
  };
