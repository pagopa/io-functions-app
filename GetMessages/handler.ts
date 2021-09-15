import {
  mapAsyncIterator
} from "@pagopa/io-functions-commons/dist/src/utils/async";
import { retrievedMessageToPublic } from "@pagopa/io-functions-commons/dist/src/utils/messages";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  IResponseSuccessPageIdBasedIterator
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import {
  flattenAsyncIterator
} from "@pagopa/io-functions-commons/dist/src/utils/async";

import {
  defaultPageSize,
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";

import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { EnrichedMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/EnrichedMessage";

import { OptionalQueryParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/optional_query_param";

import * as express from "express";
import * as A from "fp-ts/lib/Array";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";

import {
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { BooleanFromString } from "@pagopa/ts-commons/lib/booleans";
import {
  NonNegativeInteger,
  NonNegativeIntegerFromString
} from "@pagopa/ts-commons/lib/numbers";
import {
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { BlobService } from "azure-storage";
import * as O from "fp-ts/lib/Option";
import { enrichMessagesData } from "../utils/messages";

type RetrievedNotPendingMessage = t.TypeOf<typeof RetrievedNotPendingMessage>;
const RetrievedNotPendingMessage = t.intersection([
  RetrievedMessage,
  t.interface({ isPending: t.literal(false) })
]);

type IGetMessagesHandlerResponse =
  | IResponseSuccessPageIdBasedIterator<EnrichedMessage>
  | IResponseSuccessJson<{}>
  | IResponseErrorInternal
  | IResponseErrorValidation
  | IResponseErrorQuery;

/**
 * Type of a GetMessages handler.
 *
 * GetMessages expects a FiscalCode as input and returns the Messages
 * as output or a Validation error.
 *
 */
type IGetMessagesHandler = (
  fiscalCode: FiscalCode,
  maybePageSize: O.Option<NonNegativeInteger>,
  maybeEnrichResultData: O.Option<boolean>,
  maybeMaximumId: O.Option<NonEmptyString>,
  maybeMinimumId: O.Option<NonEmptyString>
) => Promise<IGetMessagesHandlerResponse>;

/**
 * Handles requests for getting all message for a recipient.
 */
export const GetMessagesHandler = (
  messageModel: MessageModel,
  serviceModel: ServiceModel,
  blobService: BlobService
): IGetMessagesHandler => async (
  fiscalCode,
  maybePageSize,
  maybeEnrichResultData,
  maybeMaximumId,
  maybeMinimumId
) =>
  pipe(
    T.Do,
    T.bind("pageSize", () =>
      T.of(O.getOrElse(() => defaultPageSize)(maybePageSize))
    ),
    T.bind("shouldEnrichResultData", () =>
      T.of(O.getOrElse(() => false)(maybeEnrichResultData))
    ),
    T.bind("maximumId", () => T.of(O.toUndefined(maybeMaximumId))),
    T.bind("minimumId", () => T.of(O.toUndefined(maybeMinimumId))),
    T.map(({ pageSize, shouldEnrichResultData, maximumId, minimumId }) =>
      pipe(
        messageModel.findMessages(fiscalCode, pageSize, maximumId, minimumId),
        TE.map(i => mapAsyncIterator(i, A.rights)),
        TE.map(i =>
          mapAsyncIterator(i, A.filter(RetrievedNotPendingMessage.is))
        ),
        TE.map(i => mapAsyncIterator(i, A.map(retrievedMessageToPublic))),
        TE.chain(i =>
          // check whether we should enrich messages or not
          pipe(
            TE.fromPredicate(
              () => shouldEnrichResultData === true,
              () =>
                // if no enrichment is requested we just wrap messages in a TE
                mapAsyncIterator(
                  i,
                  //A.map(e => TE.of<Error, CreatedMessageWithoutContent>(e))
                  A.map(async e =>
                    E.right<Error, CreatedMessageWithoutContent>(e)
                  )
                )
            )(i),
            TE.map(i =>
              mapAsyncIterator(
                i,
                enrichMessagesData(messageModel, serviceModel, blobService)
              )
            ),
            TE.orElse(TE.of)
          )
        ),
        TE.map(flattenAsyncIterator),
        TE.chain(i =>
          TE.tryCatch(() => asyncIteratorToPage(i, pageSize), E.toError)
        ),
        TE.chain(({ results, hasMoreResults }) =>
          pipe(
            results,
            E.sequenceArray,
            E.map(messages => toPageResults(messages, hasMoreResults)),
            TE.fromEither
          )
        ),
        TE.bimap(
          failure => ResponseErrorInternal(E.toError(failure).message),
          i => ResponseSuccessJson(i)
        ),
        TE.toUnion
      )()
    )
  )();

interface IPage<T> {
  results: ReadonlyArray<T>;
  hasMoreResults: boolean;
}

export const asyncIteratorToPage = async <T>(
  iter: AsyncIterator<T | Promise<T>>,
  pageSize: NonNegativeInteger
): Promise<IPage<T>> => {
  const acc = Array<T>();
  // tslint:disable-next-line: no-let
  let hasMoreResults: boolean = true;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const next = await iter.next();
    if (next.done === true) {
      hasMoreResults = false;
      break;
    }
    if (acc.length === pageSize) {
      break;
    }
    // eslint-disable-next-line functional/immutable-data
    acc.push(await next.value);
  }

  return { results: acc, hasMoreResults };
};

const toPageResults = <T extends { readonly id: string }>(
  items: ReadonlyArray<T>,
  hasMoreResults: boolean
) => {
  const next = hasMoreResults
    ? pipe(
        O.fromNullable(items[items.length - 1]),
        O.map(e => e.id),
        O.toUndefined
      )
    : undefined;
  const prev = pipe(
    O.fromNullable(items[0]),
    O.map(e => e.id),
    O.toUndefined
  );
  return {
    items,
    next,
    prev
  };
};

/**
 * Wraps a GetMessages handler inside an Express request handler.
 */
export function GetMessages(
  messageModel: MessageModel,
  serviceModel: ServiceModel,
  blobService: BlobService
): express.RequestHandler {
  const handler = GetMessagesHandler(messageModel, serviceModel, blobService);
  const middlewaresWrap = withRequestMiddlewares(
    FiscalCodeMiddleware,
    OptionalQueryParamMiddleware("page_size", NonNegativeIntegerFromString),
    OptionalQueryParamMiddleware("enrich_result_data", BooleanFromString),
    OptionalQueryParamMiddleware("maximum_id", NonEmptyString),
    OptionalQueryParamMiddleware("minimum_id", NonEmptyString)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
