import * as t from "io-ts";

import * as express from "express";

import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { BlobService } from "azure-storage";

import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";

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
import { pipe } from "fp-ts/lib/function";

type IGetVisibleServicesHandlerRet =
  | IResponseSuccessJson<PaginatedServiceTupleCollection>
  | IResponseErrorInternal;

type IGetVisibleServicesHandler = () => Promise<IGetVisibleServicesHandlerRet>;

/**
 * Returns all the visible services (is_visible = true).
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function GetVisibleServicesHandler(
  blobService: BlobService,
  onlyNationalService: boolean
): IGetVisibleServicesHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async () => {
    const errorOrMaybeVisibleServicesJson = await getBlobAsObject(
      t.record(ServiceId, VisibleService),
      blobService,
      VISIBLE_SERVICE_CONTAINER,
      VISIBLE_SERVICE_BLOB_ID
    );
    return pipe(
      errorOrMaybeVisibleServicesJson,
      E.foldW(
        error =>
          ResponseErrorInternal(
            `Error getting visible services list: ${error.message}`
          ),
        maybeVisibleServicesJson => {
          const servicesTuples = pipe(
            maybeVisibleServicesJson,
            // eslint-disable-next-line prettier/prettier
            O.getOrElse(() => ({})),
            Object.entries,
            _ => new Map<string, VisibleService>(_),
            toServicesTuple,
            arr =>
              onlyNationalService
                ? arr.filter(_ => _.scope === ServiceScopeEnum.NATIONAL)
                : arr
          );
          return ResponseSuccessJson({
            items: servicesTuples
          });
        }
      )
    );
  };
}

/**
 * Wraps a GetVisibleServices handler inside an Express request handler.
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function GetVisibleServices(
  blobService: BlobService,
  onlyNationalService: boolean
): express.RequestHandler {
  const handler = GetVisibleServicesHandler(blobService, onlyNationalService);
  return wrapRequestHandler(handler);
}
