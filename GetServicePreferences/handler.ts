import * as express from "express";

import * as e from "fp-ts/lib/Either";
import * as o from "fp-ts/lib/Option";
import * as te from "fp-ts/lib/TaskEither";

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
  ProfileModel,
  RetrievedProfile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  makeServicesPreferencesDocumentId,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import {
  toDefaultDisabledUserServicePreference,
  toDefaultEnabledUserServicePreference,
  toUserServicePreferenceFromModel
} from "../utils/service_preferences";

import { ExtendedProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/ExtendedProfile";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { NonNegativeInteger } from "@pagopa/io-functions-commons/node_modules/@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/io-functions-commons/node_modules/@pagopa/ts-commons/lib/strings";
import { identity } from "fp-ts/lib/function";
import { retrievedProfileToExtendedProfile } from "../utils/profiles";

type IGetServicePreferencesHandlerResult =
  | IResponseSuccessJson<ServicePreference>
  | IResponseErrorNotFound
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
  maybeProfile: o.Option<RetrievedProfile>
): te.TaskEither<IResponseErrorNotFound, ExtendedProfile> =>
  te
    .fromEither(
      e.fromOption(
        ResponseErrorNotFound(
          "Profile not found",
          "The profile you requested was not found in the system."
        )
      )(maybeProfile)
    )
    .map(retrievedProfileToExtendedProfile);

/**
 * Return a function that returns the service preference for the
 * given documentId and version, or a default value if not present
 * The default value depends on the user' settings (mode AUTO/MANUAL)
 *
 * @param servicePreferencesModel The service preferences cosmos model
 * @param fiscalCode the fiscal code
 * @returns
 */
export declare type getUserServicePreferencesT = (params: {
  readonly documentId: NonEmptyString;
  readonly mode: ServicesPreferencesModeEnum;
  readonly version: NonNegativeInteger;
  readonly fiscalCode: FiscalCode;
}) => te.TaskEither<IResponseErrorQuery, ServicePreference>;
const getUserServicePreferencesOrDefault = (
  servicePreferencesModel: ServicesPreferencesModel
): getUserServicePreferencesT => ({ fiscalCode, documentId, mode, version }) =>
  servicePreferencesModel
    .find([documentId, fiscalCode])
    .mapLeft(failure =>
      ResponseErrorQuery(
        "Error while retrieving the user's service preferences",
        failure
      )
    )
    .map(maybeServicePref =>
      maybeServicePref.fold<ServicePreference>(
        mode === ServicesPreferencesModeEnum.AUTO
          ? toDefaultEnabledUserServicePreference(version)
          : toDefaultDisabledUserServicePreference(version),
        pref => toUserServicePreferenceFromModel(pref)
      )
    );

/**
 * Return a type safe GetServicePreferences handler.
 */
export const GetServicePreferencesHandler = (
  profileModels: ProfileModel,
  servicePreferencesModel: ServicesPreferencesModel
): IGetServicePreferencesHandler => {
  return async (fiscalCode, serviceId) => {
    const p = profileModels
      .findLastVersionByModelId([fiscalCode])
      .mapLeft<IResponseErrorQuery | IResponseErrorNotFound>(failure =>
        ResponseErrorQuery("Error while retrieving the profile", failure)
      )
      .chain(getProfileOrErrorResponse)
      .map(profile => ({
        documentId: makeServicesPreferencesDocumentId(
          fiscalCode,
          serviceId,
          profile.service_preferences_settings.version
        ),
        fiscalCode,
        mode: profile.service_preferences_settings.mode,
        version: profile.service_preferences_settings.version
      }))
      .chain(getUserServicePreferencesOrDefault(servicePreferencesModel))
      .fold<IGetServicePreferencesHandlerResult>(identity, ResponseSuccessJson);

    return p.run();
  };
};

/**
 * Wraps a GetServicePreferences handler inside an Express request handler.
 */
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
