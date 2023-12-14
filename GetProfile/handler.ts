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
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { isBefore } from "date-fns";
import { pipe, identity } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as T from "fp-ts/lib/Task";
import { retrievedProfileToExtendedProfile } from "../utils/profiles";

import { FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED } from "../utils/unique_email_enforcement";

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

export const withIsEmailAlreadyTaken = (
  profileEmailReader: IProfileEmailReader,
  uniqueEmailEnforcementEnabled: boolean
) => (profile: ExtendedProfile): T.Task<ExtendedProfile> =>
  pipe(
    TE.of(profile),
    // VALID ONLY IF FF_UNIQUE_EMAIL_ENFORCEMENT IS ENABLED
    // Check if the e-mail address associated with the retrived
    // profile was validated. If was not validated, continue with
    // uniqueness checks.
    TE.filterOrElse(
      ({ is_email_validated }) =>
        !is_email_validated && uniqueEmailEnforcementEnabled,
      () => true
    ),
    TE.chain(({ email }) =>
      pipe(
        // Check if the e-mail is already taken (returns a boolean).
        // If there are problems checking the uniqueness of the provided
        // e-mail address, assume that the e-mail is not unique (already taken).
        // isEmailAlreadyTakenTE(profileEmailReader, profile.email),
        TE.tryCatch(
          () =>
            isEmailAlreadyTaken(email)({
              profileEmails: profileEmailReader
            }),
          () => false
        )
      )
    ),
    // Set the value of "is_email_already_taken" property
    TE.getOrElse(result => T.of(result)),
    T.map(is_email_already_taken => ({
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
  profileEmailReader: IProfileEmailReader
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
            TE.fromOption(() =>
              ResponseErrorNotFound(
                "Profile not found",
                "The profile you requested was not found in the system."
              )
            ),
            TE.map(retrievedProfileToExtendedProfile),
            TE.chainTaskK(
              withIsEmailAlreadyTaken(
                profileEmailReader,
                FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED(fiscalCode)
              )
            ),
            TE.map(ResponseSuccessJson),
            TE.getOrElseW(response => T.of(response))
          )
      ),
      TE.chainTaskK(identity),
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
  profileEmailReader: IProfileEmailReader
): express.RequestHandler {
  const handler = GetProfileHandler(
    profileModel,
    optOutEmailSwitchDate,
    isOptInEmailEnabled,
    profileEmailReader
  );
  const middlewaresWrap = withRequestMiddlewares(FiscalCodeMiddleware);
  return wrapRequestHandler(middlewaresWrap(handler));
}
