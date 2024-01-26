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
  isEmailAlreadyTaken,
  IProfileEmailReader
} from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";

import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorInternal,
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
  | IResponseErrorInternal
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

export const withIsEmailAlreadyTaken = (
  profileEmailReader: IProfileEmailReader,
  isUniqueEmailEnforcementEnabled: boolean
) => (
  profile: ExtendedProfile
): TE.TaskEither<IResponseErrorInternal, ExtendedProfile> =>
  pipe(
    TE.of(profile),
    // VALID ONLY IF FF_UNIQUE_EMAIL_ENFORCEMENT IS ENABLED
    // Check if the e-mail address associated with the retrived
    // profile was validated. If was not validated, continue with
    // uniqueness checks.
    TE.chainW(({ is_email_validated, email }) =>
      isUniqueEmailEnforcementEnabled && !is_email_validated && email
        ? TE.tryCatch(
            () =>
              isEmailAlreadyTaken(email)({
                profileEmails: profileEmailReader
              }),
            () =>
              ResponseErrorInternal(
                "Can't check if the new e-mail is already taken"
              )
          )
        : TE.of(false)
    ),
    // Set the value of "is_email_already_taken" property
    TE.map(is_email_already_taken => ({
      ...profile,
      is_email_already_taken
    }))
  );

/**
 * Return a type safe GetProfile handler.
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function GetProfileHandler(
  profileModel: ProfileModel,
  optOutEmailSwitchDate: Date,
  isOptInEmailEnabled: boolean,
  profileEmailReader: IProfileEmailReader,
  FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED: (fiscalCode: FiscalCode) => boolean
): IGetProfileHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, arrow-body-style
  return async fiscalCode => {
    return pipe(
      profileModel.findLastVersionByModelId([fiscalCode]),
      TE.mapLeft(failure =>
        ResponseErrorQuery("Error while retrieving the profile", failure)
      ),
      TE.chainW(maybeProfile =>
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
          TE.fromOption(() =>
            ResponseErrorNotFound(
              "Profile not found",
              "The profile you requested was not found in the system."
            )
          ),
          TE.map(retrievedProfileToExtendedProfile),
          TE.chainW(
            withIsEmailAlreadyTaken(
              profileEmailReader,
              FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED(fiscalCode)
            )
          ),
          TE.map(ResponseSuccessJson)
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
  isOptInEmailEnabled: boolean,
  profileEmailReader: IProfileEmailReader,
  FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED: (fiscalCode: FiscalCode) => boolean
): express.RequestHandler {
  const handler = GetProfileHandler(
    profileModel,
    optOutEmailSwitchDate,
    isOptInEmailEnabled,
    profileEmailReader,
    FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED
  );
  const middlewaresWrap = withRequestMiddlewares(FiscalCodeMiddleware);
  return wrapRequestHandler(middlewaresWrap(handler));
}
