import { StrMap } from "fp-ts/lib/StrMap";
import * as t from "io-ts";

import * as express from "express";

import { BlobService } from "azure-storage";

import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";

import {
  toServicesTuple,
  VISIBLE_SERVICE_BLOB_ID,
  VISIBLE_SERVICE_CONTAINER,
  VisibleService
} from "@pagopa/io-functions-commons/dist/src/models/visible_service";

import { getBlobAsObject } from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";
import { wrapRequestHandler } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";

import { PaginatedServiceTupleCollection } from "@pagopa/io-functions-commons/dist/generated/definitions/PaginatedServiceTupleCollection";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { ServiceScopeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceScope";
import { ServiceTuple } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceTuple";
import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";

type IGetVisibleServicesHandlerRet =
  | IResponseSuccessJson<PaginatedServiceTupleCollection>
  | IResponseErrorInternal;

type IGetVisibleServicesHandler = () => Promise<IGetVisibleServicesHandlerRet>;

/**
 * Returns all the visible services (is_visible = true).
 */
export function GetVisibleServicesHandler(
  blobService: BlobService,
  onlyNationalService: boolean,
  limitLocalServices?: NonNegativeInteger
): IGetVisibleServicesHandler {
  return async () => {
    const errorOrMaybeVisibleServicesJson = await getBlobAsObject(
      t.dictionary(ServiceId, VisibleService),
      blobService,
      VISIBLE_SERVICE_CONTAINER,
      VISIBLE_SERVICE_BLOB_ID
    );
    return errorOrMaybeVisibleServicesJson.fold<IGetVisibleServicesHandlerRet>(
      error =>
        ResponseErrorInternal(
          `Error getting visible services list: ${error.message}`
        ),
      maybeVisibleServicesJson => {
        const allServicesTuples = toServicesTuple(
          new StrMap(maybeVisibleServicesJson.getOrElse({}))
        );
        const scopedServicesTuples = allServicesTuples.reduce(
          (acc, service) => {
            if (service.scope === ServiceScopeEnum.LOCAL) {
              return {
                [ServiceScopeEnum.NATIONAL]: acc[ServiceScopeEnum.NATIONAL],
                [ServiceScopeEnum.LOCAL]: [
                  ...acc[ServiceScopeEnum.LOCAL],
                  service
                ]
              };
            }
            return {
              [ServiceScopeEnum.NATIONAL]: [
                ...acc[ServiceScopeEnum.NATIONAL],
                service
              ],
              [ServiceScopeEnum.LOCAL]: acc[ServiceScopeEnum.LOCAL]
            };
          },
          {
            [ServiceScopeEnum.NATIONAL]: [] as ReadonlyArray<ServiceTuple>,
            [ServiceScopeEnum.LOCAL]: [] as ReadonlyArray<ServiceTuple>
          }
        );
        const servicesTuples = onlyNationalService
          ? scopedServicesTuples[ServiceScopeEnum.NATIONAL]
          : limitLocalServices === undefined
          ? allServicesTuples
          : [
              ...scopedServicesTuples[ServiceScopeEnum.NATIONAL],
              ...scopedServicesTuples[ServiceScopeEnum.LOCAL].slice(
                0,
                limitLocalServices
              )
            ];
        return ResponseSuccessJson({
          items: servicesTuples,
          page_size: servicesTuples.length
        });
      }
    );
  };
}

/**
 * Wraps a GetVisibleServices handler inside an Express request handler.
 */
export function GetVisibleServices(
  blobService: BlobService,
  onlyNationalService: boolean,
  limitLocalServices?: NonNegativeInteger
): express.RequestHandler {
  const handler = GetVisibleServicesHandler(
    blobService,
    onlyNationalService,
    limitLocalServices
  );
  return wrapRequestHandler(handler);
}
