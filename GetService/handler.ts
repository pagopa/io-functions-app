/*
 * Implements the Public API handlers for the Services resource.
 */

import * as express from "express";

import {
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import {
  RetrievedService,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";

import {
  NotificationChannel,
  NotificationChannelEnum
} from "@pagopa/io-functions-commons/dist/generated/definitions/NotificationChannel";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { ServicePublic } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicePublic";
import { toApiServiceMetadata } from "@pagopa/io-functions-commons/dist/src/utils/service_metadata";

import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";

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
    service_metadata: retrievedService.serviceMetadata
      ? toApiServiceMetadata(retrievedService.serviceMetadata)
      : undefined,
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
    pipe(
      await serviceModel.findOneByServiceId(serviceId)(),
      E.foldW(
        error =>
          ResponseErrorQuery("Error while retrieving the service", error),
        maybeService =>
          pipe(
            maybeService,
            O.foldW(
              () =>
                ResponseErrorNotFound(
                  "Service not found",
                  "The service you requested was not found in the system."
                ),
              service => ResponseSuccessJson(retrievedServiceToPublic(service))
            )
          )
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
