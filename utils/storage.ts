import { ServiceResponse, TableService } from "azure-storage";

import { Either, left, right } from "fp-ts/lib/Either";
import { none, Option, some } from "fp-ts/lib/Option";

import { ITuple2, Tuple2 } from "@pagopa/ts-commons/lib/tuples";

/**
 * A promisified version of TableService.insertEntity
 */
export const insertTableEntity = (
  tableService: TableService,
  table: string
) => <T>(
  entityDescriptor: T
): Promise<
  ITuple2<
    Either<Error, T | TableService.EntityMetadata>,
    ServiceResponse | null
  >
  // eslint-disable-next-line arrow-body-style
> => {
  return new Promise(resolve =>
    tableService.insertEntity(
      table,
      entityDescriptor,
      (
        error: Error | null,
        result: T | TableService.EntityMetadata,
        response: ServiceResponse | null
      ) =>
        resolve(
          // We need to check error first because response could be null
          // @ref https://github.com/Azure/azure-storage-node/blob/v2.10.2/lib/common/services/storageserviceclient.js#L250
          error || !response.isSuccessful
            ? Tuple2(
                left(error || new Error("Unsuccessful response from storage")),
                response
              )
            : Tuple2(right(result), response)
        )
    )
  );
};

/**
 * A promisified version of TableService.deleteEntity
 */
export const deleteTableEntity = (
  tableService: TableService,
  table: string
) => <T>(
  entityDescriptor: T
  // eslint-disable-next-line arrow-body-style
): Promise<ITuple2<Option<Error>, ServiceResponse | null>> => {
  return new Promise(resolve =>
    tableService.deleteEntity(
      table,
      entityDescriptor,
      (error: Error | null, response: ServiceResponse | null) =>
        resolve(
          // We need to check error first because response could be null
          // @ref https://github.com/Azure/azure-storage-node/blob/v2.10.2/lib/common/services/storageserviceclient.js#L250
          error || !response.isSuccessful
            ? Tuple2(
                some(error || new Error("Unsuccessful response from storage")),
                response
              )
            : Tuple2(none, response)
        )
    )
  );
};
