import * as express from "express";

import { sequenceS } from "fp-ts/lib/Apply";
import * as e from "fp-ts/lib/Either";
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
  Profile,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  Service,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import {
  makeServicesPreferencesDocumentId,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  IResponseErrorConflict,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import {
  getServicePreferenceSettingsVersion,
  nonLegacyServicePreferences,
  toUserServicePreferenceFromModel
} from "../utils/service_preferences";

import { NonNegativeInteger } from "@pagopa/io-functions-commons/node_modules/@pagopa/ts-commons/lib/numbers";
import { identity } from "fp-ts/lib/function";

type IUpsertServicePreferencesHandlerResult =
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
type IUpsertServicePreferencesHandler = (
  fiscalCode: FiscalCode,
  serviceId: ServiceId,
  servicePreference: ServicePreference
) => Promise<IUpsertServicePreferencesHandlerResult>;

/**
 * Return a task containing either an error or the required Profile
 */
const getProfileOrErrorResponse = (profileModels: ProfileModel) => (
  fiscalCode: FiscalCode
): te.TaskEither<IResponseErrorQuery | IResponseErrorNotFound, Profile> =>
  profileModels
    .findLastVersionByModelId([fiscalCode])
    .mapLeft<IResponseErrorQuery | IResponseErrorNotFound>(failure =>
      ResponseErrorQuery("Error while retrieving the profile", failure)
    )
    .chain(maybeProfile =>
      te.fromEither(
        e.fromOption(
          ResponseErrorNotFound(
            "Profile not found",
            "The profile you requested was not found in the system."
          )
        )(maybeProfile)
      )
    );

/**
 * Return a task containing either an error or the required Service
 */
const getServiceOrErrorResponse = (serviceModel: ServiceModel) => (
  serviceId: ServiceId
): te.TaskEither<IResponseErrorQuery | IResponseErrorNotFound, Service> =>
  serviceModel
    .findLastVersionByModelId([serviceId])
    .mapLeft<IResponseErrorQuery | IResponseErrorNotFound>(failure =>
      ResponseErrorQuery("Error while retrieving the service", failure)
    )
    .chain(maybeService =>
      te.fromEither(
        e.fromOption(
          ResponseErrorNotFound(
            "Service not found",
            "The service you requested was not found in the system."
          )
        )(maybeService)
      )
    );

/**
 * Return a function that returns the service preference for the
 * given documentId and version, or a default value if not present
 * The default value depends on the user' settings (mode AUTO/MANUAL)
 *
 * @param servicePreferencesModel The service preferences cosmos model
 * @param fiscalCode the fiscal code
 * @returns
 */
export declare type upsertUserServicePreferencesT = (params: {
  readonly serviceId: ServiceId;
  readonly version: NonNegativeInteger;
  readonly fiscalCode: FiscalCode;
  readonly servicePreferencesToUpsert: ServicePreference;
}) => te.TaskEither<IResponseErrorQuery, ServicePreference>;
const upsertUserServicePreferences = (
  servicePreferencesModel: ServicesPreferencesModel
): upsertUserServicePreferencesT => ({
  fiscalCode,
  serviceId,
  version,
  servicePreferencesToUpsert
}) =>
  servicePreferencesModel
    .upsert({
      fiscalCode,
      id: makeServicesPreferencesDocumentId(fiscalCode, serviceId, version),
      isEmailEnabled: servicePreferencesToUpsert.is_email_enabled,
      isInboxEnabled: servicePreferencesToUpsert.is_inbox_enabled,
      isWebhookEnabled: servicePreferencesToUpsert.is_webhook_enabled,
      kind: "INewServicePreference",
      serviceId,
      settingsVersion: version
    })
    .mapLeft(l =>
      ResponseErrorQuery("Error while saving user' service preferences", l)
    )
    .map(toUserServicePreferenceFromModel);

/**
 * Return a type safe GetServicePreferences handler.
 */
export const GetUpsertServicePreferencesHandler = (
  profileModels: ProfileModel,
  serviceModels: ServiceModel,
  servicePreferencesModel: ServicesPreferencesModel
): IUpsertServicePreferencesHandler => {
  return async (fiscalCode, serviceId, servicePreference) =>
    sequenceS(te.taskEither)({
      profile: getProfileOrErrorResponse(profileModels)(fiscalCode),
      service: getServiceOrErrorResponse(serviceModels)(serviceId)
    })
      .mapLeft<
        IResponseErrorQuery | IResponseErrorNotFound | IResponseErrorConflict
      >(identity)
      .filterOrElse(
        ({ profile }) => nonLegacyServicePreferences(profile),
        ResponseErrorConflict("Legacy service preferences not allowed")
      )
      .filterOrElse(
        ({ profile }) =>
          servicePreference.settings_version ===
          profile.servicePreferencesSettings.version,
        ResponseErrorConflict(
          "Setting Preferences version not compatible with Profile's one"
        )
      )
      .chain(({ profile }) =>
        getServicePreferenceSettingsVersion(profile)
          .mapLeft(_ =>
            ResponseErrorConflict("Service Preferences Version < 0 not allowed")
          )
          .map(version => ({
            fiscalCode,
            serviceId,
            servicePreferencesToUpsert: servicePreference,
            version
          }))
      )
      .chain(upsertUserServicePreferences(servicePreferencesModel))
      .fold<IUpsertServicePreferencesHandlerResult>(
        identity,
        ResponseSuccessJson
      )
      .run();
};

/**
 * Wraps a UpsertServicePreferences handler inside an Express request handler.
 */
export function UpsertServicePreferences(
  profileModels: ProfileModel,
  serviceModels: ServiceModel,
  servicePreferencesModel: ServicesPreferencesModel
): express.RequestHandler {
  const handler = GetUpsertServicePreferencesHandler(
    profileModels,
    serviceModels,
    servicePreferencesModel
  );

  const middlewaresWrap = withRequestMiddlewares(
    // ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("serviceId", ServiceId),
    RequiredBodyPayloadMiddleware(ServicePreference)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
