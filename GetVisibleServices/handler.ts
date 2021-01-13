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
        const servicesTuples = toServicesTuple(
          new StrMap(maybeVisibleServicesJson.getOrElse({}))
        );
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
