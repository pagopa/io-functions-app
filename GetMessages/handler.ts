import {
  asyncIteratorToArray,
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
  IResponseSuccessPageIdBasedIterator,
  ResponseErrorQuery,
  ResponsePageIdBasedIterator
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import {
  filterAsyncIterator,
  flattenAsyncIterator
} from "@pagopa/io-functions-commons/dist/src/utils/async";

import {
  defaultPageSize,
  MessageModel,
  MessageWithoutContent,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";

import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { EnrichedMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/EnrichedMessage";

import { OptionalQueryParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/optional_query_param";

import * as express from "express";
import { isRight } from "fp-ts/lib/Either";
import { flow, identity, pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";
import * as A from "fp-ts/lib/Array";

import {
  NonNegativeInteger,
  NonNegativeIntegerFromString
} from "@pagopa/ts-commons/lib/numbers";
import { BooleanFromString } from "@pagopa/ts-commons/lib/booleans";
import {
  IResponseErrorGeneric,
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorGeneric,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as O from "fp-ts/lib/Option";
import {
  Service,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { BlobService } from "azure-storage";
import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";
import { toCosmosErrorResponse } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import {
  fillPage,
  PageResults
} from "@pagopa/io-functions-commons/dist/src/utils/paging";
import { enrichMessageData, enrichMessagesData } from "../utils/messages";

type RetrievedNotPendingMessage = t.TypeOf<typeof RetrievedNotPendingMessage>;
const RetrievedNotPendingMessage = t.intersection([
  RetrievedMessage,
  t.interface({ isPending: t.literal(false) })
]);

type IGetMessagesHandlerResponse =
  | IResponseSuccessPageIdBasedIterator<EnrichedMessage>
  | IResponseSuccessJson<PageResults>
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
                // if no enrichment is requested we just wrap messages in a Promise<Right>
                mapAsyncIterator(
                  i,
                  A.map(async (e: CreatedMessageWithoutContent) =>
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
        TE.map(i =>
          mapAsyncIterator(i, async e => pipe(await e, E.getOrElseW(identity)))
        ),
        TE.chain(i => TE.tryCatch(() => fillPageC(i, pageSize), E.toError)),
        TE.bimap(
          failure => ResponseErrorInternal(E.toError(failure).message),
          i => ResponseSuccessJson(i)
        ),
        TE.toUnion
      )()
    )
  )();

export const fillPageB = async <
  T extends E.Either<Error, { readonly id: string }>
>(
  iter: AsyncIterator<T, T>,
  expectedPageSize: NonNegativeInteger
) => {
  // eslint-disable-next-line functional/prefer-readonly-type
  const items: { readonly id: string }[] = [];
  // eslint-disable-next-line functional/no-let
  let hasMoreResults: boolean = true;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await iter.next();
    if (done) {
      hasMoreResults = false;
      break;
    }
    if (items.length === expectedPageSize) {
      break;
    }

    if (E.isLeft(value)) {
      return TE.left(new Error("errore"))();
    } else {
      // eslint-disable-next-line functional/immutable-data
      items.push(value.right);
    }
  }

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
  const x = TE.of<Error, PageResults>(
    PageResults.encode({ hasMoreResults, items, next, prev })
  )();
  return x;
};

const fillPageC = async <T extends { readonly id: string }>(
  iter: AsyncIterator<T, T>,
  expectedPageSize: NonNegativeInteger
): Promise<PageResults> => {
  // eslint-disable-next-line functional/prefer-readonly-type
  const items: T[] = [];
  // eslint-disable-next-line functional/no-let
  let hasMoreResults: boolean = true;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (items.length === expectedPageSize) {
      break;
    }

    const { done, value } = await iter.next();

    if (done) {
      hasMoreResults = false;
      break;
    }

    // eslint-disable-next-line functional/immutable-data
    items.push(value);
  }

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
  return { hasMoreResults, items, next, prev };
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
