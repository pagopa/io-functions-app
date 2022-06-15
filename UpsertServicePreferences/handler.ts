import * as express from "express";

import * as t from "io-ts";

import { sequenceS } from "fp-ts/lib/Apply";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";

import { FiscalCode } from "@pagopa/io-functions-commons/dist/generated/definitions/FiscalCode";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { ServicePreference } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicePreference";
import { UpsertServicePreference } from "@pagopa/io-functions-commons/dist/generated/definitions/UpsertServicePreference";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";

import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import { ProfileModel } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { ServiceModel } from "@pagopa/io-functions-commons/dist/src/models/service";
import {
  AccessReadMessageStatusEnum,
  makeServicesPreferencesDocumentId,
  ServicesPreferencesModel,
  NewServicePreference
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  IResponseErrorConflict,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseErrorValidation,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";

import { Context } from "@azure/functions";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { enumType } from "@pagopa/ts-commons/lib/types";

import { initAppInsights } from "@pagopa/ts-commons/lib/appinsights";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { TableService } from "azure-storage";
import { ActivationModel } from "@pagopa/io-functions-commons/dist/src/models/activation";
import { SpecialServiceCategoryEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/SpecialServiceCategory";
import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { getServiceCategoryOrStandard } from "../utils/services";
import {
  getServicePreferenceSettingsVersion,
  getServicePreferencesForSpecialServices,
  nonLegacyServicePreferences,
  toUserServicePreferenceFromModel
} from "../utils/service_preferences";
import { createTracker } from "../utils/tracking";
import { makeServiceSubscribedEvent } from "../utils/emitted_events";
import { getProfileOrErrorResponse } from "../utils/profiles";
import { getServiceOrErrorResponse } from "../utils/services";
import { updateSubscriptionFeedTask } from "./subscription_feed";

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
  | IResponseErrorValidation
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
 * Return a function that returns the service preference for the
 * given documentId and version, or a default value if not present
 * The default value depends on the user' settings (mode AUTO/MANUAL)
 *
 * @param servicePreferencesModel The service preferences cosmos model
 * @param fiscalCode the fiscal code
 * @returns
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export declare type upsertUserServicePreferencesT = (params: {
  readonly serviceId: ServiceId;
  readonly version: NonNegativeInteger;
  readonly fiscalCode: FiscalCode;
  readonly servicePreferencesToUpsert: UpsertServicePreference;
}) => TE.TaskEither<
  IResponseErrorQuery | IResponseErrorValidation,
  ServicePreference
>;
const upsertUserServicePreferences = (
  servicePreferencesModel: ServicesPreferencesModel
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
): upsertUserServicePreferencesT => ({
  fiscalCode,
  serviceId,
  version,
  servicePreferencesToUpsert
}) =>
  pipe(
    O.fromNullable(servicePreferencesToUpsert.can_access_message_read_status),
    O.map(choice =>
      choice
        ? AccessReadMessageStatusEnum.ALLOW
        : AccessReadMessageStatusEnum.DENY
    ),
    O.getOrElse(() => AccessReadMessageStatusEnum.UNKNOWN),
    accessReadMessageStatus =>
      NewServicePreference.decode({
        accessReadMessageStatus,
        fiscalCode,
        id: makeServicesPreferencesDocumentId(fiscalCode, serviceId, version),
        isEmailEnabled: servicePreferencesToUpsert.is_email_enabled,
        isInboxEnabled: servicePreferencesToUpsert.is_inbox_enabled,
        isWebhookEnabled: servicePreferencesToUpsert.is_webhook_enabled,
        kind: "INewServicePreference",
        serviceId,
        settingsVersion: version
      }),
    E.mapLeft(e =>
      ResponseErrorValidation(
        "Cannot decode NewServicePreference",
        errorsToReadableMessages(e).join(" | ")
      )
    ),
    TE.fromEither,
    TE.chainW(newServicePreference =>
      pipe(
        servicePreferencesModel.upsert(newServicePreference),
        TE.mapLeft(l =>
          ResponseErrorQuery("Error while saving user' service preferences", l)
        )
      )
    ),
    TE.map(toUserServicePreferenceFromModel)
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const decodeOperation = (isInboxEnabled: boolean) =>
  isInboxEnabled
    ? FeedOperationEnum.SUBSCRIBED
    : FeedOperationEnum.UNSUBSCRIBED;

/**
 * Calculate Feed operation to perform by considering:
 * - the previous service preference's inboxEnabled (if exists)
 
 * - the current one that should be upserted.
 *
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
  activationModel: ActivationModel,
  tableService: TableService,
  subscriptionFeedTableName: NonEmptyString,
  logPrefix: string = "GetUpsertServicePreferencesHandler"
  // eslint-disable-next-line max-params, arrow-body-style
): IUpsertServicePreferencesHandler => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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
      TE.chain(({ profile, service }) =>
        pipe(
          profile,
          getServicePreferenceSettingsVersion,
          TE.mapLeft(_ =>
            ResponseErrorConflict("Service Preferences Version < 0 not allowed")
          ),
          TE.map(version => ({
            fiscalCode,
            serviceCategory: getServiceCategoryOrStandard(service),
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
              ),
              // if the operation will determine a new subscription for the service
              isSubscribing: pipe(
                maybeExistingServicesPreference,
                O.fold(
                  () => results.servicePreferencesToUpsert.is_inbox_enabled,
                  existing =>
                    results.servicePreferencesToUpsert.is_inbox_enabled &&
                    existing.isInboxEnabled === false
                )
              )
            })
          )
        )
      ),
      TE.chain(resultsWithSubFeedInfo => {
        if (
          resultsWithSubFeedInfo.serviceCategory ===
          SpecialServiceCategoryEnum.SPECIAL
        ) {
          return pipe(
            getServicePreferencesForSpecialServices(activationModel)({
              fiscalCode,
              serviceId,
              servicePreferences: servicePreference
            }),
            TE.chainW(
              TE.fromPredicate(
                specialServicePreference =>
                  specialServicePreference.is_inbox_enabled ===
                  servicePreference.is_inbox_enabled,
                () => ResponseErrorConflict("Unexpected is_inbox_enabled value")
              )
            ),
            TE.map(specialServicePreference => ({
              ...resultsWithSubFeedInfo,
              feedOperation: FeedOperationEnum.NO_UPDATE,
              isSubscribing: false,
              servicePreferencesToUpsert: specialServicePreference
            }))
          );
        }
        return TE.of(resultsWithSubFeedInfo);
      }),
      TE.chainW(resultsWithSubFeedInfo =>
        pipe(
          resultsWithSubFeedInfo,
          upsertUserServicePreferences(servicePreferencesModel),
          TE.map(upsertedUserServicePreference => ({
            ...resultsWithSubFeedInfo,
            updatedAt: new Date().getTime(),
            upsertedUserServicePreference
          }))
        )
      ),
      TE.map(resultsWithSubFeedInfo => {
        // if it's a new subscription, emit relative event
        if (resultsWithSubFeedInfo.isSubscribing) {
          // eslint-disable-next-line functional/immutable-data
          context.bindings.apievents = pipe(
            makeServiceSubscribedEvent(
              resultsWithSubFeedInfo.serviceId,
              resultsWithSubFeedInfo.fiscalCode
            ),
            JSON.stringify
          );
        }
        return resultsWithSubFeedInfo;
      }),
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
// eslint-disable-next-line max-params, prefer-arrow/prefer-arrow-functions
export function UpsertServicePreferences(
  telemetryClient: ReturnType<typeof initAppInsights>,
  profileModels: ProfileModel,
  serviceModels: ServiceModel,
  servicePreferencesModel: ServicesPreferencesModel,
  activationModel: ActivationModel,
  tableService: TableService,
  subscriptionFeedTableName: NonEmptyString
): express.RequestHandler {
  const handler = GetUpsertServicePreferencesHandler(
    telemetryClient,
    profileModels,
    serviceModels,
    servicePreferencesModel,
    activationModel,
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
