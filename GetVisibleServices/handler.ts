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
} from "io-functions-commons/dist/src/models/visible_service";

import { getBlobAsObject } from "io-functions-commons/dist/src/utils/azure_storage";
import { wrapRequestHandler } from "io-functions-commons/dist/src/utils/request_middleware";

import { PaginatedServiceTupleCollection } from "io-functions-commons/dist/generated/definitions/PaginatedServiceTupleCollection";
import { ServiceId } from "io-functions-commons/dist/generated/definitions/ServiceId";

type IGetVisibleServicesHandlerRet =
  | IResponseSuccessJson<PaginatedServiceTupleCollection>
  | IResponseErrorInternal;

type IGetVisibleServicesHandler = () => Promise<IGetVisibleServicesHandlerRet>;

/**
 * Returns all the visible services (is_visible = true).
 */
export function GetVisibleServicesHandler(
  blobService: BlobService
): IGetVisibleServicesHandler {
  return async () => {
    const errorOrVisibleServicesJson = await getBlobAsObject(
      t.dictionary(ServiceId, VisibleService),
      blobService,
      VISIBLE_SERVICE_CONTAINER,
      VISIBLE_SERVICE_BLOB_ID
    );
    return errorOrVisibleServicesJson.fold<IGetVisibleServicesHandlerRet>(
      error =>
        ResponseErrorInternal(
          `Error getting visible services list: ${error.message}`
        ),
      visibleServicesJson => {
        const servicesTuples = toServicesTuple(new StrMap(visibleServicesJson));
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
  blobService: BlobService
): express.RequestHandler {
  const handler = GetVisibleServicesHandler(blobService);
  return wrapRequestHandler(handler);
}
