import * as express from "express";

import { Context } from "@azure/functions";

import * as df from "durable-functions";

import { isLeft } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";

import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";

import {
  IRequestMiddleware,
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";

import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "io-functions-commons/dist/src/utils/response";
import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseErrorFromValidationErrors,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import { FiscalCode } from "italia-ts-commons/lib/strings";

import {
  Profile,
  ProfileModel,
  RetrievedProfile
} from "io-functions-commons/dist/src/models/profile";
import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";

import { ExtendedProfile } from "io-functions-commons/dist/generated/definitions/ExtendedProfile";
import { toExtendedProfile } from "../utils/profiles";
import { UpdatedProfileEvent } from "../utils/UpdatedProfileEvent";

/**
 * Type of an UpsertProfile handler.
 *
 * UpsertProfile expects a FiscalCode and a Profile as input and
 * returns a Profile or a Validation or a Generic error.
 */
type IUpsertProfileHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  profileModelPayload: ExtendedProfile
) => Promise<
  // tslint:disable-next-line:max-union-size
  | IResponseSuccessJson<ExtendedProfile>
  | IResponseErrorValidation
  | IResponseErrorQuery
  | IResponseErrorInternal
  | IResponseErrorConflict
>;

/**
 * A middleware that extracts a Profile payload from a request.
 */
export const ProfilePayloadMiddleware: IRequestMiddleware<
  "IResponseErrorValidation",
  ExtendedProfile
> = request =>
  new Promise(resolve => {
    const validation = ExtendedProfile.decode(request.body);
    const result = validation.mapLeft(
      ResponseErrorFromValidationErrors(ExtendedProfile)
    );
    resolve(result);
  });

async function createNewProfileFromPayload(
  context: Context,
  logPrefix: string,
  profileModel: ProfileModel,
  fiscalCode: FiscalCode,
  profileModelPayload: ExtendedProfile
): Promise<IResponseSuccessJson<ExtendedProfile> | IResponseErrorQuery> {
  const profile: Profile = {
    acceptedTosVersion: profileModelPayload.accepted_tos_version,
    blockedInboxOrChannels: profileModelPayload.blocked_inbox_or_channels,
    email: profileModelPayload.email,
    fiscalCode,
    isInboxEnabled: profileModelPayload.is_inbox_enabled,
    isWebhookEnabled: profileModelPayload.is_webhook_enabled,
    preferredLanguages: profileModelPayload.preferred_languages
  };

  context.log.verbose(`${logPrefix}|Creating new profile`);

  const errorOrProfile = await profileModel.create(profile, profile.fiscalCode);

  if (isLeft(errorOrProfile)) {
    context.log.error(`${logPrefix}|ERROR=${errorOrProfile.value.body}`);
    return ResponseErrorQuery(
      "Error while creating a new profile",
      errorOrProfile.value
    );
  }

  const newProfile = errorOrProfile.value;

  // if we successfully created the user's profile
  // broadcast a profile-created event

  const event: UpdatedProfileEvent = {
    newProfile
  };

  const dfClient = df.getClient(context);

  await dfClient.startNew("UpdatedProfileOrchestrator", undefined, event);

  return ResponseSuccessJson(toExtendedProfile(newProfile));
}

async function updateExistingProfileFromPayload(
  context: Context,
  logPrefix: string,
  profileModel: ProfileModel,
  existingProfile: RetrievedProfile,
  profileModelPayload: ExtendedProfile
): Promise<
  | IResponseSuccessJson<ExtendedProfile>
  | IResponseErrorQuery
  | IResponseErrorInternal
> {
  const profile: Profile = {
    acceptedTosVersion: profileModelPayload.accepted_tos_version,
    blockedInboxOrChannels: profileModelPayload.blocked_inbox_or_channels,
    email: profileModelPayload.email,
    fiscalCode: existingProfile.fiscalCode,
    isInboxEnabled: profileModelPayload.is_inbox_enabled,
    isWebhookEnabled: profileModelPayload.is_webhook_enabled,
    preferredLanguages: profileModelPayload.preferred_languages
  };

  context.log.verbose(`${logPrefix}|Updating profile`);

  const errorOrMaybeProfile = await profileModel.update(
    existingProfile.id,
    existingProfile.fiscalCode,
    p => {
      return {
        ...p,
        ...profile
      };
    }
  );

  if (isLeft(errorOrMaybeProfile)) {
    context.log.error(`${logPrefix}|ERROR=${errorOrMaybeProfile.value.body}`);
    return ResponseErrorQuery(
      "Error while updating the existing profile",
      errorOrMaybeProfile.value
    );
  }

  const maybeProfile = errorOrMaybeProfile.value;

  if (maybeProfile.isNone()) {
    // this should never happen since if the profile doesn't exist this function
    // will never be called, but let's deal with this anyway, you never know
    return ResponseErrorInternal(
      "Error while updating the existing profile, the profile does not exist!"
    );
  }

  const newProfile = maybeProfile.value;

  // if we successfully updated the user's profile
  // broadcast a profile-updated event
  const event: UpdatedProfileEvent = {
    newProfile,
    oldProfile: existingProfile
  };

  const dfClient = df.getClient(context);

  await dfClient.startNew("UpdatedProfileOrchestrator", undefined, event);

  return ResponseSuccessJson(toExtendedProfile(newProfile));
}

/**
 * This handler will receive attributes for a profile and create a
 * profile with those attributes if the profile does not yet exist or
 * update the profile with it already exist.
 */
export function UpsertProfileHandler(
  profileModel: ProfileModel
): IUpsertProfileHandler {
  return async (context, fiscalCode, profileModelPayload) => {
    const logPrefix = `UpsertProfileHandler|PROFILE=${fiscalCode}|UPDATE_VERSION=${profileModelPayload.version}`;
    const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(
      fiscalCode
    );

    if (isLeft(errorOrMaybeProfile)) {
      context.log.error(`${logPrefix}|ERROR=${errorOrMaybeProfile.value.body}`);
      return ResponseErrorQuery("Error", errorOrMaybeProfile.value);
    }
    const maybeProfile = errorOrMaybeProfile.value;

    if (isNone(maybeProfile)) {
      // create a new profile
      return await createNewProfileFromPayload(
        context,
        logPrefix,
        profileModel,
        fiscalCode,
        profileModelPayload
      );
    } else {
      const existingProfile = maybeProfile.value;
      // verify that the client asked to update the latest version
      if (profileModelPayload.version !== existingProfile.version) {
        context.log.warn(
          `${logPrefix}|CURRENT_VERSION=${existingProfile.version}|RESULT=CONFLICT`
        );
        return ResponseErrorConflict(
          `Version ${profileModelPayload.version} is not the latest version.`
        );
      }
      // update existing profile
      return await updateExistingProfileFromPayload(
        context,
        logPrefix,
        profileModel,
        existingProfile,
        profileModelPayload
      );
    }
  };
}

/**
 * Wraps an UpsertProfile handler inside an Express request handler.
 */
export function UpsertProfile(
  profileModel: ProfileModel
): express.RequestHandler {
  const handler = UpsertProfileHandler(profileModel);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    ProfilePayloadMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
