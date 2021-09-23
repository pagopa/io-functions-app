import * as express from "express";

import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

import { FiscalCode } from "@pagopa/io-functions-commons/dist/generated/definitions/FiscalCode";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { ServicePreference } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicePreference";
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
  Profile,
  ProfileModel,
  RetrievedProfile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  makeServicesPreferencesDocumentId,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  IResponseErrorConflict,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";

import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { pipe } from "fp-ts/lib/function";
import {
  getServicePreferenceSettingsVersion,
  nonLegacyServicePreferences,
  toDefaultDisabledUserServicePreference,
  toDefaultEnabledUserServicePreference,
  toUserServicePreferenceFromModel
} from "../utils/service_preferences";

type IGetServicePreferencesHandlerResult =
  | IResponseSuccessJson<ServicePreference>
  | IResponseErrorNotFound
  | IResponseErrorConflict
  | IResponseErrorQuery;

/**
 * Type of a GetServicePreferences handler.
 *
 * GetServicePreferences expects a FiscalCode as input and returns a Profile or
 * a Not Found error.
 */
type IGetServicePreferencesHandler = (
  fiscalCode: FiscalCode,
  serviceId: ServiceId
) => Promise<IGetServicePreferencesHandlerResult>;

/**
 *
 * @param maybeProfile
 * @returns
 */
const getProfileOrErrorResponse = (
  maybeProfile: O.Option<RetrievedProfile>
): TE.TaskEither<IResponseErrorNotFound, Profile> =>
  TE.fromOption(() =>
    ResponseErrorNotFound(
      "Profile not found",
      "The profile you requested was not found in the system."
    )
  )(maybeProfile);

/**
 * Return a function that returns the service preference for the
 * given documentId and version, or a default value if not present
 * The default value depends on the user' settings (mode AUTO/MANUAL)
 *
 * @param servicePreferencesModel The service preferences cosmos model
 * @param fiscalCode the fiscal code
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export declare type getUserServicePreferencesT = (params: {
  readonly serviceId: ServiceId;
  readonly mode:
    | ServicesPreferencesModeEnum.AUTO
    | ServicesPreferencesModeEnum.MANUAL;
  readonly version: NonNegativeInteger;
  readonly fiscalCode: FiscalCode;
}) => TE.TaskEither<IResponseErrorQuery, ServicePreference>;
const getUserServicePreferencesOrDefault = (
  servicePreferencesModel: ServicesPreferencesModel
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
): getUserServicePreferencesT => ({ fiscalCode, serviceId, mode, version }) =>
  pipe(
    servicePreferencesModel.find([
      makeServicesPreferencesDocumentId(fiscalCode, serviceId, version),
      fiscalCode
    ]),
    TE.mapLeft(failure =>
      ResponseErrorQuery(
        "Error while retrieving the user's service preferences",
        failure
      )
    ),
    TE.map(maybeServicePref =>
      pipe(
        maybeServicePref,
        O.fold(
          () => {
            // eslint-disable-next-line default-case
            switch (mode) {
              case ServicesPreferencesModeEnum.AUTO:
                return toDefaultEnabledUserServicePreference(version);
              case ServicesPreferencesModeEnum.MANUAL:
                return toDefaultDisabledUserServicePreference(version);
            }
          },
          pref => toUserServicePreferenceFromModel(pref)
        )
      )
    )
  );

/**
 * Return a type safe GetServicePreferences handler.
 */
export const GetServicePreferencesHandler = (
  profileModels: ProfileModel,
  servicePreferencesModel: ServicesPreferencesModel
  // eslint-disable-next-line arrow-body-style
): IGetServicePreferencesHandler => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async (fiscalCode, serviceId) =>
    pipe(
      profileModels.findLastVersionByModelId([fiscalCode]),
      TE.mapLeft(failure =>
        ResponseErrorQuery("Error while retrieving the profile", failure)
      ),
      TE.chainW(getProfileOrErrorResponse),
      TE.filterOrElseW(nonLegacyServicePreferences, () =>
        ResponseErrorConflict("Legacy service preferences not allowed")
      ),
      TE.chain(profile =>
        pipe(
          getServicePreferenceSettingsVersion(profile),
          TE.mapLeft(_ =>
            ResponseErrorConflict("Service Preferences Version < 0 not allowed")
          ),
          TE.map(version => ({
            fiscalCode,
            mode: profile.servicePreferencesSettings.mode,
            serviceId,
            version
          }))
        )
      ),
      TE.chainW(getUserServicePreferencesOrDefault(servicePreferencesModel)),
      TE.map(ResponseSuccessJson),
      TE.toUnion
    )();
};

/**
 * Wraps a GetServicePreferences handler inside an Express request handler.
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function GetServicePreferences(
  profileModels: ProfileModel,
  servicePreferencesModel: ServicesPreferencesModel
): express.RequestHandler {
  const handler = GetServicePreferencesHandler(
    profileModels,
    servicePreferencesModel
  );

  const middlewaresWrap = withRequestMiddlewares(
    // ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("serviceId", ServiceId)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
