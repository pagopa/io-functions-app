import * as express from "express";

import { ExtendedProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/ExtendedProfile";
import { ProfileModel } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";

import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import {
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { isBefore } from "date-fns";
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
  profileModel: ProfileModel,
  emailModeSwitchLimitDate: Date
): IGetProfileHandler {
  return async fiscalCode =>
    profileModel
      .findLastVersionByModelId([fiscalCode])
      .fold(
        failure =>
          ResponseErrorQuery("Error while retrieving the profile", failure),
        maybeProfile =>
          maybeProfile
            .map(_ =>
              // if profile's timestamp is before email mode switch limit date we must force isEmailEnabled to false
              // this map is valid for ever so this check cannot be removed
              isBefore(_._ts, emailModeSwitchLimitDate)
                ? { ..._, isEmailEnabled: false }
                : _
            )
            .fold<IGetProfileHandlerResult>(
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
export function GetProfile(
  profileModel: ProfileModel,
  emailModeSwitchLimitDate: Date
): express.RequestHandler {
  const handler = GetProfileHandler(profileModel, emailModeSwitchLimitDate);

  const middlewaresWrap = withRequestMiddlewares(FiscalCodeMiddleware);
  return wrapRequestHandler(middlewaresWrap(handler));
}
