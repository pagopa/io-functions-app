import * as express from "express";
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

type IGetProfileHandlerResult =
  | IResponseSuccessJson<ExtendedProfile>
  | IResponseErrorNotFound
  | IResponseErrorQuery;

/**
 * Type of a GetProfile handler.
 *
 * GetProfile expects a FiscalCode as input and returns a Profile or
 * a Not Found error.
 */
type IGetProfileHandler = (
  fiscalCode: FiscalCode
) => Promise<IGetProfileHandlerResult>;

/**
 * Return a type safe GetProfile handler.
 */
export function GetProfileHandler(
  profileModel: ProfileModel
): IGetProfileHandler {
  return async fiscalCode =>
    profileModel
      .findLastVersionByModelId(fiscalCode)
      .fold(
        failure =>
          ResponseErrorQuery("Error while retrieving the profile", failure),
        maybeProfile =>
          maybeProfile.fold<IGetProfileHandlerResult>(
            ResponseErrorNotFound(
              "Profile not found",
              "The profile you requested was not found in the system."
            ),
            profile =>
              ResponseSuccessJson(retrievedProfileToExtendedProfile(profile))
          )
      )
      .run();
}

/**
 * Wraps a GetProfile handler inside an Express request handler.
 */
export function GetProfile(profileModel: ProfileModel): express.RequestHandler {
  const handler = GetProfileHandler(profileModel);

  const middlewaresWrap = withRequestMiddlewares(FiscalCodeMiddleware);
  return wrapRequestHandler(middlewaresWrap(handler));
}
