import * as express from "express";

import { Context } from "@azure/functions";
import * as df from "durable-functions";

import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { withoutUndefinedValues } from "@pagopa/ts-commons/lib/types";

import { Profile as ApiProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/Profile";
import {
  ProfileModel,
  RetrievedProfile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";

import { QueueClient, QueueSendMessageResponse } from "@azure/storage-queue";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { MigrateServicesPreferencesQueueMessage } from "../MigrateServicePreferenceFromLegacy/handler";
import { OrchestratorInput as UpsertedProfileOrchestratorInput } from "../UpsertedProfileOrchestrator/handler";
import { ProfileMiddleware } from "../utils/middlewares/profile";
import {
  apiProfileToProfile,
  retrievedProfileToExtendedProfile
} from "../utils/profiles";

import { toHash } from "../utils/crypto";
import { createTracker } from "../utils/tracking";

/**
 * Type of an UpdateProfile handler.
 */
type IUpdateProfileHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  profilePayload: ApiProfile
) => Promise<
  | IResponseSuccessJson<ApiProfile>
  | IResponseErrorQuery
  | IResponseErrorNotFound
  | IResponseErrorConflict
  | IResponseErrorInternal
>;

const migratePreferences = (
  queueClient: QueueClient,
  oldProfile: RetrievedProfile,
  newProfile: RetrievedProfile
): TE.TaskEither<Error, QueueSendMessageResponse> =>
  TE.tryCatch(
    () =>
      queueClient
        // Default message TTL is 7 days @ref https://docs.microsoft.com/it-it/azure/storage/queues/storage-nodejs-how-to-use-queues?tabs=javascript#queue-service-concepts
        .sendMessage(
          Buffer.from(
            JSON.stringify(
              MigrateServicesPreferencesQueueMessage.encode({
                newProfile,
                oldProfile
              })
            )
          ).toString("base64")
        ),
    E.toError
  );

// eslint-disable-next-line sonarjs/cognitive-complexity
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function UpdateProfileHandler(
  profileModel: ProfileModel,
  queueClient: QueueClient,
  tracker: ReturnType<typeof createTracker>
): IUpdateProfileHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async (context, fiscalCode, profilePayload) => {
    const logPrefix = `UpdateProfileHandler|FISCAL_CODE=${toHash(fiscalCode)}`;

    const errorOrMaybeExistingProfile = await profileModel.findLastVersionByModelId(
      [fiscalCode]
    )();

    if (E.isLeft(errorOrMaybeExistingProfile)) {
      return ResponseErrorQuery(
        "Error trying to retrieve existing profile",
        errorOrMaybeExistingProfile.left
      );
    }

    const maybeExistingProfile = errorOrMaybeExistingProfile.right;
    if (O.isNone(maybeExistingProfile)) {
      return ResponseErrorNotFound(
        "Error",
        "Could not find a profile with the provided fiscalcode"
      );
    }
    const existingProfile = maybeExistingProfile.value;

    // Verify that the client asked to update the latest version
    if (profilePayload.version !== existingProfile.version) {
      context.log.warn(
        `${logPrefix}|CURRENT_VERSION=${existingProfile.version}|PREV_VERSION=${profilePayload.version}|RESULT=CONFLICT`
      );
      return ResponseErrorConflict(
        `Version ${profilePayload.version} is not the latest version.`
      );
    }

    // Check if the email has been changed
    const emailChanged =
      profilePayload.email !== undefined &&
      profilePayload.email !== existingProfile.email;

    // Get servicePreferencesSettings mode from payload or default to LEGACY
    const requestedServicePreferencesSettingsMode = pipe(
      O.fromNullable(profilePayload.service_preferences_settings),
      O.map(_ => _.mode),
      O.getOrElse(() => ServicesPreferencesModeEnum.LEGACY)
    );

    // Check if a mode change is requested
    const isServicePreferencesSettingsModeChanged =
      requestedServicePreferencesSettingsMode !==
      existingProfile.servicePreferencesSettings.mode;

    // return to LEGACY profile from updated ones is forbidden
    if (
      isServicePreferencesSettingsModeChanged &&
      requestedServicePreferencesSettingsMode ===
        ServicesPreferencesModeEnum.LEGACY
    ) {
      context.log.warn(
        `${logPrefix}|REQUESTED_MODE=${requestedServicePreferencesSettingsMode}|CURRENT_MODE=${existingProfile.servicePreferencesSettings.mode}|RESULT=CONFLICT`
      );
      return ResponseErrorConflict(
        `Mode ${requestedServicePreferencesSettingsMode} is not valid.`
      );
    }

    const servicePreferencesSettingsVersion = isServicePreferencesSettingsModeChanged
      ? Number(existingProfile.servicePreferencesSettings.version) + 1
      : existingProfile.servicePreferencesSettings.version;

    const profile = apiProfileToProfile(
      profilePayload,
      fiscalCode,
      emailChanged ? false : existingProfile.isEmailValidated,
      servicePreferencesSettingsVersion
    );

    // User inbox and webhook must be enabled after accepting the ToS for the first time
    // https://www.pivotaltracker.com/story/show/175095963
    const autoEnableInboxAndWebHook =
      existingProfile.acceptedTosVersion === undefined &&
      profile.acceptedTosVersion !== undefined;
    const overriddenInboxAndWebhook = autoEnableInboxAndWebHook
      ? { isInboxEnabled: true, isWebhookEnabled: true }
      : {};
    // If the user profile was on LEGACY mode we update blockedInboxOrChannels
    // Otherwise we remove the property
    const overrideBlockedInboxOrChannels =
      profile.servicePreferencesSettings.mode ===
      ServicesPreferencesModeEnum.LEGACY
        ? // To be compliant with the previous implementation if the provided blocked_inbox_or_channel
          // is undefined the stored value remains unchanged
          profile.blockedInboxOrChannels ||
          existingProfile.blockedInboxOrChannels
        : undefined;

    const errorOrMaybeUpdatedProfile = await profileModel.update({
      ...existingProfile,
      // Remove undefined values to avoid overriding already existing profile properties
      ...withoutUndefinedValues(profile),
      ...overriddenInboxAndWebhook,
      // Override blockedInboxOrChannel when mode change from LEGACY to MANUAL or AUTO
      blockedInboxOrChannels: overrideBlockedInboxOrChannels,
      // Override lastAppVersion for users switched to a downgraded app version that doesn't provide the value in the request payload
      lastAppVersion: profile.lastAppVersion
    })();

    if (E.isLeft(errorOrMaybeUpdatedProfile)) {
      context.log.error(
        `${logPrefix}|ERROR=${errorOrMaybeUpdatedProfile.left.kind}`
      );
      return ResponseErrorQuery(
        "Error while updating the existing profile",
        errorOrMaybeUpdatedProfile.left
      );
    }

    const updateProfile = errorOrMaybeUpdatedProfile.right;

    // a mode change occurred, we trace before and after
    if (isServicePreferencesSettingsModeChanged) {
      tracker.profile.traceServicePreferenceModeChange(
        fiscalCode,
        existingProfile.servicePreferencesSettings.mode,
        requestedServicePreferencesSettingsMode,
        updateProfile.version
      );
    }
    // mode hasn't changed, but the user is still updating a LEGACY profile
    //  this trace monitors how many users did not upgrade yet
    else if (
      updateProfile.servicePreferencesSettings.mode ===
      ServicesPreferencesModeEnum.LEGACY
    ) {
      tracker.profile.traceServicePreferenceModeChange(
        fiscalCode,
        ServicesPreferencesModeEnum.LEGACY,
        ServicesPreferencesModeEnum.LEGACY,
        updateProfile.version
      );
    }

    const dfClient = df.getClient(context);

    // Start the Orchestrator
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.encode(
      {
        newProfile: updateProfile,
        oldProfile: existingProfile,
        updatedAt: new Date()
      }
    );
    // TODO: To enable the new orchestration change to UpsertedProfileOrchestrator
    // Change the orchestrator after that in production the code is available to enable rollback
    await dfClient.startNew(
      "UpsertedProfileOrchestrator",
      undefined,
      upsertedProfileOrchestratorInput
    );

    // Queue services preferences migration
    if (
      existingProfile.blockedInboxOrChannels &&
      existingProfile.servicePreferencesSettings.mode ===
        ServicesPreferencesModeEnum.LEGACY &&
      updateProfile.servicePreferencesSettings.mode ===
        ServicesPreferencesModeEnum.AUTO
    ) {
      tracker.profile.traceMigratingServicePreferences(
        existingProfile,
        updateProfile,
        "REQUESTING"
      );
      await pipe(
        migratePreferences(queueClient, existingProfile, updateProfile),
        TE.mapLeft(err =>
          context.log.error(
            `${logPrefix}|Cannot send a message to the queue ${
              queueClient.name
            } |ERROR=${JSON.stringify(err)}`
          )
        )
      )();
    }

    return ResponseSuccessJson(
      retrievedProfileToExtendedProfile(updateProfile)
    );
  };
}

/**
 * Wraps an UpdateProfile handler inside an Express request handler.
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function UpdateProfile(
  profileModel: ProfileModel,
  queueClient: QueueClient,
  tracker: ReturnType<typeof createTracker>
): express.RequestHandler {
  const handler = UpdateProfileHandler(profileModel, queueClient, tracker);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    ProfileMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
