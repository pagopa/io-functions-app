import * as express from "express";

import * as t from "io-ts";

import { sequenceS } from "fp-ts/lib/Apply";
import { pipe } from "fp-ts/lib/function";
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

import { Context } from "@azure/functions";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { enumType } from "@pagopa/ts-commons/lib/types";

import { updateSubscriptionFeedTask } from "./subscription_feed";

import { initAppInsights } from "@pagopa/ts-commons/lib/appinsights";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { TableService } from "azure-storage";
import { createTracker } from "../utils/tracking";

enum FeedOperationEnum {
  "SUBSCRIBED" = "SUBSCRIBED",
  "UNSUBSCRIBED" = "UNSUBSCRIBED",
  "NO_UPDATE" = "NO_UPDATE"
}

export type FeedOperation = t.TypeOf<typeof FeedOperation>;
export const FeedOperation = enumType<FeedOperationEnum>(
  FeedOperationEnum,
  "FeedOperation"
);

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
  context: Context,
  fiscalCode: FiscalCode,
  serviceId: ServiceId,
  servicePreference: ServicePreference
) => Promise<IUpsertServicePreferencesHandlerResult>;

/**
 * Return a task containing either an error or the required Profile
 */
const getProfileOrErrorResponse = (profileModels: ProfileModel) => (
  fiscalCode: FiscalCode
): TE.TaskEither<IResponseErrorQuery | IResponseErrorNotFound, Profile> =>
  pipe(
    profileModels.findLastVersionByModelId([fiscalCode]),
    TE.mapLeft(failure =>
      ResponseErrorQuery("Error while retrieving the profile", failure)
    ),
    TE.chainW(
      TE.fromOption(() =>
        ResponseErrorNotFound(
          "Profile not found",
          "The profile you requested was not found in the system."
        )
      )
    )
  );

/**
 * Return a task containing either an error or the required Service
 */
const getServiceOrErrorResponse = (serviceModel: ServiceModel) => (
  serviceId: ServiceId
): TE.TaskEither<IResponseErrorQuery | IResponseErrorNotFound, Service> =>
  pipe(
    serviceModel.findLastVersionByModelId([serviceId]),
    TE.mapLeft(failure =>
      ResponseErrorQuery("Error while retrieving the service", failure)
    ),
    TE.chainW(
      TE.fromOption(() =>
        ResponseErrorNotFound(
          "Service not found",
          "The service you requested was not found in the system."
        )
      )
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
}) => TE.TaskEither<IResponseErrorQuery, ServicePreference>;
const upsertUserServicePreferences = (
  servicePreferencesModel: ServicesPreferencesModel
): upsertUserServicePreferencesT => ({
  fiscalCode,
  serviceId,
  version,
  servicePreferencesToUpsert
}) =>
  pipe(
    servicePreferencesModel.upsert({
      fiscalCode,
      id: makeServicesPreferencesDocumentId(fiscalCode, serviceId, version),
      isEmailEnabled: servicePreferencesToUpsert.is_email_enabled,
      isInboxEnabled: servicePreferencesToUpsert.is_inbox_enabled,
      isWebhookEnabled: servicePreferencesToUpsert.is_webhook_enabled,
      kind: "INewServicePreference",
      serviceId,
      settingsVersion: version
    }),
    TE.mapLeft(l =>
      ResponseErrorQuery("Error while saving user' service preferences", l)
    ),
    TE.map(toUserServicePreferenceFromModel)
  );

const decodeOperation = (isInboxEnabled: boolean) =>
  isInboxEnabled
    ? FeedOperationEnum.SUBSCRIBED
    : FeedOperationEnum.UNSUBSCRIBED;

/**
 * Calculate Feed operation to perform by considering:
 * - the previous service preference's inboxEnabled (if exists)
 * - the current one that should be upserted.
 * @param maybePreviousInboxEnabled The previous service preference's inboxEnabled property
 * @param currentInboxEnabled The current service preference's inboxEnabled property
 * @returns a FeedOperation to be performed. Possible values are SUBSCRIBED, UNSUBSCRIBED or NO_UPDATE
 */
const getFeedOperation = (
  maybePreviousInboxEnabled: O.Option<boolean>,
  currentInboxEnabled: boolean
): FeedOperation =>
  pipe(
    maybePreviousInboxEnabled,
    O.fold(
      () => decodeOperation(currentInboxEnabled),
      prev =>
        prev !== currentInboxEnabled
          ? decodeOperation(currentInboxEnabled)
          : FeedOperationEnum.NO_UPDATE
    )
  );
/**
 * Return a type safe GetServicePreferences handler.
 */
export const GetUpsertServicePreferencesHandler = (
  telemetryClient: ReturnType<typeof initAppInsights>,
  profileModels: ProfileModel,
  serviceModels: ServiceModel,
  servicePreferencesModel: ServicesPreferencesModel,
  tableService: TableService,
  subscriptionFeedTableName: NonEmptyString,
  logPrefix: string = "GetUpsertServicePreferencesHandler"
): IUpsertServicePreferencesHandler => {
  return async (context, fiscalCode, serviceId, servicePreference) =>
    pipe(
      sequenceS(TE.ApplicativeSeq)({
        profile: getProfileOrErrorResponse(profileModels)(fiscalCode),
        service: getServiceOrErrorResponse(serviceModels)(serviceId)
      }),
      TE.filterOrElseW(
        ({ profile }) => nonLegacyServicePreferences(profile),
        () => ResponseErrorConflict("Legacy service preferences not allowed")
      ),
      TE.filterOrElse(
        ({ profile }) =>
          servicePreference.settings_version ===
          profile.servicePreferencesSettings.version,
        () =>
          ResponseErrorConflict(
            "Setting Preferences version not compatible with Profile's one"
          )
      ),
      TE.chain(({ profile }) =>
        pipe(
          profile,
          getServicePreferenceSettingsVersion,
          TE.mapLeft(_ =>
            ResponseErrorConflict("Service Preferences Version < 0 not allowed")
          ),
          TE.map(version => ({
            fiscalCode,
            serviceId,
            servicePreferencesToUpsert: servicePreference,
            version
          }))
        )
      ),
      TE.chainW(results =>
        pipe(
          servicePreferencesModel.find([
            makeServicesPreferencesDocumentId(
              fiscalCode,
              serviceId,
              results.version
            ),
            fiscalCode
          ]),
          TE.bimap(
            failure =>
              ResponseErrorQuery(
                "Error while retrieving the user's service preferences",
                failure
              ),
            maybeExistingServicesPreference => ({
              ...results,
              feedOperation: getFeedOperation(
                pipe(
                  maybeExistingServicesPreference,
                  O.map(pref => pref.isInboxEnabled)
                ),
                results.servicePreferencesToUpsert.is_inbox_enabled
              )
            })
          )
        )
      ),
      TE.chainW(results =>
        pipe(
          results,
          upsertUserServicePreferences(servicePreferencesModel),
          TE.map(upsertedUserServicePreference => ({
            ...results,
            updatedAt: new Date().getTime(),
            upsertedUserServicePreference
          }))
        )
      ),
      TE.chain(
        ({
          feedOperation,
          updatedAt,
          version,
          upsertedUserServicePreference
        }) =>
          feedOperation !== FeedOperationEnum.NO_UPDATE
            ? pipe(
                updateSubscriptionFeedTask(
                  tableService,
                  subscriptionFeedTableName,
                  context,
                  {
                    fiscalCode,
                    operation: feedOperation,
                    serviceId,
                    subscriptionKind: "SERVICE",
                    updatedAt,
                    version
                  },
                  logPrefix,
                  createTracker(telemetryClient)
                ),
                TE.map(() => upsertedUserServicePreference)
              )
            : TE.of(upsertedUserServicePreference)
      ),
      TE.map(ResponseSuccessJson),
      TE.toUnion
    )();
};

/**
 * Wraps a UpsertServicePreferences handler inside an Express request handler.
 */
export function UpsertServicePreferences(
  telemetryClient: ReturnType<typeof initAppInsights>,
  profileModels: ProfileModel,
  serviceModels: ServiceModel,
  servicePreferencesModel: ServicesPreferencesModel,
  tableService: TableService,
  subscriptionFeedTableName: NonEmptyString
): express.RequestHandler {
  const handler = GetUpsertServicePreferencesHandler(
    telemetryClient,
    profileModels,
    serviceModels,
    servicePreferencesModel,
    tableService,
    subscriptionFeedTableName
  );

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("serviceId", ServiceId),
    RequiredBodyPayloadMiddleware(ServicePreference)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
