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
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
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
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function GetProfileHandler(
  profileModel: ProfileModel,
  optOutEmailSwitchDate: Date,
  isOptInEmailEnabled: boolean
): IGetProfileHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, arrow-body-style
  return async fiscalCode => {
    return pipe(
      profileModel.findLastVersionByModelId([fiscalCode]),
      TE.bimap(
        failure =>
          ResponseErrorQuery("Error while retrieving the profile", failure),
        maybeProfile =>
          pipe(
            maybeProfile,
            O.map(_ =>
              // if profile's timestamp is before email opt out switch limit date we must force isEmailEnabled to false
              // this map is valid for ever so this check cannot be removed.
              // Please note that cosmos timestamps are expressed in unix notation (in seconds), so we must transform
              // it to a common Date representation.
              // eslint-disable-next-line no-underscore-dangle
              isOptInEmailEnabled && isBefore(_._ts, optOutEmailSwitchDate)
                ? { ..._, isEmailEnabled: false }
                : _
            ),
            O.foldW(
              () =>
                ResponseErrorNotFound(
                  "Profile not found",
                  "The profile you requested was not found in the system."
                ),
              profile =>
                ResponseSuccessJson(retrievedProfileToExtendedProfile(profile))
            )
          )
      ),
      TE.toUnion
    )();
  };
}

/**
 * Wraps a GetProfile handler inside an Express request handler.
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function GetProfile(
  profileModel: ProfileModel,
  optOutEmailSwitchDate: Date,
  isOptInEmailEnabled: boolean
): express.RequestHandler {
  const handler = GetProfileHandler(
    profileModel,
    optOutEmailSwitchDate,
    isOptInEmailEnabled
  );

  const middlewaresWrap = withRequestMiddlewares(FiscalCodeMiddleware);
  return wrapRequestHandler(middlewaresWrap(handler));
}
