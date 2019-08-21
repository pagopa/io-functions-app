import * as express from "express";

import { FiscalCode } from "italia-ts-commons/lib/strings";

import { mapResultIterator } from "io-functions-commons/dist/src/utils/documentdb";
import { RequiredParamMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  IResponseSuccessJsonIterator,
  ResponseJsonIterator
} from "io-functions-commons/dist/src/utils/response";

import { SenderServiceModel } from "io-functions-commons/dist/src/models/sender_service";

import { ServiceTuple } from "io-functions-commons/dist/generated/definitions/ServiceTuple";

type IGetSenderServicesHandlerRet =
  | IResponseSuccessJsonIterator<ServiceTuple>
  | IResponseErrorQuery;

type IGetSenderServicesHandler = (
  fiscalCode: FiscalCode
) => Promise<IGetSenderServicesHandlerRet>;

/**
 * Returns the serviceId for all the Services that have sent
 * at least one notification to the recipient with the provided fiscalCode.
 */
export function GetServicesForRecipientHandler(
  senderServiceModel: SenderServiceModel
): IGetSenderServicesHandler {
  return async fiscalCode => {
    const retrievedServicesIterator = senderServiceModel.findSenderServicesForRecipient(
      fiscalCode
    );
    const senderServicesIterator = mapResultIterator(
      retrievedServicesIterator,
      service => ({
        service_id: service.serviceId,
        version: service.version
      })
    );
    return ResponseJsonIterator(senderServicesIterator);
  };
}

/**
 * Wraps a GetSenderServices handler inside an Express request handler.
 */
export function GetServicesForRecipient(
  senderServiceModel: SenderServiceModel
): express.RequestHandler {
  const handler = GetServicesForRecipientHandler(senderServiceModel);

  const middlewaresWrap = withRequestMiddlewares(
    RequiredParamMiddleware("fiscalcode", FiscalCode)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
