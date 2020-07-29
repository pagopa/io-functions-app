/*
 * Implements the Public API handlers for the Services resource.
 */

import * as express from "express";

import {
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import { NonEmptyString } from "italia-ts-commons/lib/strings";

import { RequiredParamMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "io-functions-commons/dist/src/utils/response";

import {
  RetrievedService,
  ServiceModel
} from "io-functions-commons/dist/src/models/service";

import {
  NotificationChannel,
  NotificationChannelEnum
} from "io-functions-commons/dist/generated/definitions/NotificationChannel";
import { ServiceId } from "io-functions-commons/dist/generated/definitions/ServiceId";
import { ServicePublic } from "io-functions-commons/dist/generated/definitions/ServicePublic";

type IGetServiceHandlerRet =
  | IResponseSuccessJson<ServicePublic>
  | IResponseErrorNotFound
  | IResponseErrorQuery;

type IGetServiceHandler = (
  serviceId: ServiceId
) => Promise<IGetServiceHandlerRet>;

export function serviceAvailableNotificationChannels(
  retrievedService: RetrievedService
): ReadonlyArray<NotificationChannel> {
  if (retrievedService.requireSecureChannels) {
    return [NotificationChannelEnum.WEBHOOK];
  }
  return [NotificationChannelEnum.EMAIL, NotificationChannelEnum.WEBHOOK];
}

/**
 * Converts a retrieved service to a service that can be shared via API
 */
function retrievedServiceToPublic(
  retrievedService: RetrievedService
): ServicePublic {
  return {
    available_notification_channels: serviceAvailableNotificationChannels(
      retrievedService
    ),
    department_name: retrievedService.departmentName,
    organization_fiscal_code: retrievedService.organizationFiscalCode,
    organization_name: retrievedService.organizationName,
    service_id: retrievedService.serviceId,
    service_metadata: retrievedService.serviceMetadata && {
      address: retrievedService.serviceMetadata.address,
      app_android: retrievedService.serviceMetadata.appAndroid,
      app_ios: retrievedService.serviceMetadata.appIos,
      description: retrievedService.serviceMetadata.description,
      email: retrievedService.serviceMetadata.email,
      pec: retrievedService.serviceMetadata.pec,
      phone: retrievedService.serviceMetadata.phone,
      privacy_url: retrievedService.serviceMetadata.privacyUrl,
      scope: retrievedService.serviceMetadata.scope,
      tos_url: retrievedService.serviceMetadata.tosUrl,
      web_url: retrievedService.serviceMetadata.webUrl
    },
    service_name: retrievedService.serviceName,
    version: retrievedService.version
  };
}

/**
 * Extracts the serviceId value from the URL path parameter.
 */
const requiredServiceIdMiddleware = RequiredParamMiddleware(
  "serviceid",
  NonEmptyString
);

export function GetServiceHandler(
  serviceModel: ServiceModel
): IGetServiceHandler {
  return async serviceId =>
    (await serviceModel.findOneByServiceId(serviceId).run()).fold<
      IGetServiceHandlerRet
    >(
      error => ResponseErrorQuery("Error while retrieving the service", error),
      maybeService =>
        maybeService.foldL<
          IResponseErrorNotFound | IResponseSuccessJson<ServicePublic>
        >(
          () =>
            ResponseErrorNotFound(
              "Service not found",
              "The service you requested was not found in the system."
            ),
          service => ResponseSuccessJson(retrievedServiceToPublic(service))
        )
    );
}

/**
 * Wraps a GetService handler inside an Express request handler.
 */
export function GetService(serviceModel: ServiceModel): express.RequestHandler {
  const handler = GetServiceHandler(serviceModel);
  const middlewaresWrap = withRequestMiddlewares(requiredServiceIdMiddleware);
  return wrapRequestHandler(middlewaresWrap(handler));
}
