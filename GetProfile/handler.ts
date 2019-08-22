import * as express from "express";

import { isRight } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

import {
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import {
  ProfileModel,
  RetrievedProfile
} from "io-functions-commons/dist/src/models/profile";

import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "io-functions-commons/dist/src/utils/response";

import { ExtendedProfile } from "io-functions-commons/dist/generated/definitions/ExtendedProfile";

/**
 * Type of a GetProfile handler.
 *
 * GetProfile expects a FiscalCode as input and returns a Profile or
 * a Not Found error.
 */
type IGetProfileHandler = (
  fiscalCode: FiscalCode
) => Promise<
  | IResponseSuccessJson<ExtendedProfile>
  | IResponseErrorNotFound
  | IResponseErrorQuery
>;

function toExtendedProfile(profile: RetrievedProfile): ExtendedProfile {
  return {
    accepted_tos_version: profile.acceptedTosVersion,
    blocked_inbox_or_channels: profile.blockedInboxOrChannels,
    email: profile.email,
    is_inbox_enabled: profile.isInboxEnabled === true,
    is_webhook_enabled: profile.isWebhookEnabled === true,
    preferred_languages: profile.preferredLanguages,
    version: profile.version
  };
}

/**
 * Return a type safe GetProfile handler.
 */
export function GetProfileHandler(
  profileModel: ProfileModel
): IGetProfileHandler {
  return async fiscalCode => {
    const errorOrMaybeProfile = await profileModel.findOneProfileByFiscalCode(
      fiscalCode
    );
    if (isRight(errorOrMaybeProfile)) {
      const maybeProfile = errorOrMaybeProfile.value;
      if (isSome(maybeProfile)) {
        const profile = maybeProfile.value;
        // if the client is a trusted application we return the
        // extended profile
        return ResponseSuccessJson(toExtendedProfile(profile));
      } else {
        return ResponseErrorNotFound(
          "Profile not found",
          "The profile you requested was not found in the system."
        );
      }
    } else {
      return ResponseErrorQuery(
        "Error while retrieving the profile",
        errorOrMaybeProfile.value
      );
    }
  };
}

/**
 * Wraps a GetProfile handler inside an Express request handler.
 */
export function GetProfile(profileModel: ProfileModel): express.RequestHandler {
  const handler = GetProfileHandler(profileModel);

  const middlewaresWrap = withRequestMiddlewares(FiscalCodeMiddleware);
  return wrapRequestHandler(middlewaresWrap(handler));
}
