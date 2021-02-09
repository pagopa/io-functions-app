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
import { fromNullable } from "fp-ts/lib/Option";
import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";

type IGetVisibleServicesHandlerRet =
  | IResponseSuccessJson<PaginatedServiceTupleCollection>
  | IResponseErrorInternal;

type IGetVisibleServicesHandler = () => Promise<IGetVisibleServicesHandlerRet>;

const NationalServiceTuple = t.intersection([
  ServiceTuple,
  t.interface({
    scope: t.literal(ServiceScopeEnum.NATIONAL)
  })
]);
type NationalServiceTuple = t.TypeOf<typeof NationalServiceTuple>;

const LocalServiceTuple = t.intersection([
  ServiceTuple,
  t.interface({
    scope: t.literal(ServiceScopeEnum.LOCAL)
  })
]);
type LocalServiceTuple = t.TypeOf<typeof LocalServiceTuple>;

const ScopeGroupedServices = t.interface({
  [ServiceScopeEnum.NATIONAL]: t.readonlyArray(NationalServiceTuple),
  [ServiceScopeEnum.LOCAL]: t.readonlyArray(LocalServiceTuple)
});
type ScopeGroupedServices = t.TypeOf<typeof ScopeGroupedServices>;

const VisibleServiceDictionary = t.dictionary(ServiceId, VisibleService);
type VisibleServiceDictionary = t.TypeOf<typeof VisibleServiceDictionary>;

/**
 * Returns VisibleServices grouped by scope.
 */
const groupByScope = (
  serviceJson: VisibleServiceDictionary
): ScopeGroupedServices =>
  toServicesTuple(new StrMap(serviceJson)).reduce(
    (acc, service) => {
      if (LocalServiceTuple.is(service)) {
        return {
          ...acc,
          [ServiceScopeEnum.LOCAL]: [...acc[ServiceScopeEnum.LOCAL], service]
        };
      }
      return {
        ...acc,
        [ServiceScopeEnum.NATIONAL]: [
          ...acc[ServiceScopeEnum.NATIONAL],
          (service as unknown) as NationalServiceTuple
        ]
      };
    },
    {
      [ServiceScopeEnum.NATIONAL]: [],
      [ServiceScopeEnum.LOCAL]: []
    } as ScopeGroupedServices
  );

/**
 * Returns and array of visible services limiting local scoped Services.
 */
const limitLocalServicesTuples = (
  scopeGroupedServiceTuples: ScopeGroupedServices,
  localServicesLimit: NonNegativeInteger
): ReadonlyArray<ServiceTuple> => [
  ...scopeGroupedServiceTuples[ServiceScopeEnum.NATIONAL],
  ...scopeGroupedServiceTuples[ServiceScopeEnum.LOCAL].slice(
    0,
    localServicesLimit
  )
];

/**
 * Returns all the visible services (is_visible = true).
 */
export function GetVisibleServicesHandler(
  blobService: BlobService,
  localServicesLimit?: NonNegativeInteger
): IGetVisibleServicesHandler {
  return async () => {
    const errorOrMaybeVisibleServicesJson = await getBlobAsObject(
      VisibleServiceDictionary,
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
        const servicesTuples = fromNullable(localServicesLimit)
          .map(_ =>
            limitLocalServicesTuples(
              groupByScope(maybeVisibleServicesJson.getOrElse({})),
              localServicesLimit
            )
          )
          .getOrElseL(() =>
            toServicesTuple(new StrMap(maybeVisibleServicesJson.getOrElse({})))
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
  blobService: BlobService,
  localServicesLimit?: NonNegativeInteger
): express.RequestHandler {
  const handler = GetVisibleServicesHandler(blobService, localServicesLimit);
  return wrapRequestHandler(handler);
}
