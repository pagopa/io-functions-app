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

import { ProfileModel } from "io-functions-commons/dist/src/models/profile";

import { ExtendedProfile } from "io-functions-commons/dist/generated/definitions/ExtendedProfile";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "io-functions-commons/dist/src/utils/response";

import { retrievedProfileToExtendedProfile } from "../utils/profiles";

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
        return ResponseSuccessJson(retrievedProfileToExtendedProfile(profile));
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
