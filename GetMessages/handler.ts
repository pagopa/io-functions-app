// eslint-disable-next-line prettier/prettier

import {
  asyncIteratorToPageArray,
  flattenAsyncIterator,
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
  ResponseErrorQuery
} from "@pagopa/io-functions-commons/dist/src/utils/response";
import {
  PageResults,
  toPageResults
} from "@pagopa/io-functions-commons/dist/src/utils/paging";
import {
  defaultPageSize,
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { OptionalQueryParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/optional_query_param";
import * as express from "express";
import * as A from "fp-ts/lib/Array";
import * as E from "fp-ts/lib/Either";
import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { ServiceModel } from "@pagopa/io-functions-commons/dist/src/models/service";
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
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { Context } from "@azure/functions";
import { MessageStatusModel } from "@pagopa/io-functions-commons/dist/src/models/message_status";
import { enrichMessagesData, enrichMessagesStatus } from "../utils/messages";

type RetrievedNotPendingMessage = t.TypeOf<typeof RetrievedNotPendingMessage>;
const RetrievedNotPendingMessage = t.intersection([
  RetrievedMessage,
  t.interface({ isPending: t.literal(false) })
]);

type IGetMessagesHandlerResponse =
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
  context: Context,
  fiscalCode: FiscalCode,
  maybePageSize: O.Option<NonNegativeInteger>,
  maybeEnrichResultData: O.Option<boolean>,
  maybeGetArchived: O.Option<boolean>,
  maybeMaximumId: O.Option<NonEmptyString>,
  maybeMinimumId: O.Option<NonEmptyString>
) => Promise<IGetMessagesHandlerResponse>;

/**
 * Handles requests for getting all message for a recipient.
 */
export const GetMessagesHandler = (
  messageModel: MessageModel,
  messageStatusModel: MessageStatusModel,
  serviceModel: ServiceModel,
  blobService: BlobService
): IGetMessagesHandler => async (
  context,
  fiscalCode,
  maybePageSize,
  maybeEnrichResultData,
  maybeGetArchived,
  maybeMaximumId,
  maybeMinimumId
  // eslint-disable-next-line max-params
): Promise<IGetMessagesHandlerResponse> =>
  pipe(
    TE.Do,
    TE.bind("pageSize", () =>
      TE.of(O.getOrElse(() => defaultPageSize)(maybePageSize))
    ),
    TE.bind("shouldEnrichResultData", () =>
      TE.of(O.getOrElse(() => false)(maybeEnrichResultData))
    ),
    TE.bind("shouldGetArchivedMessages", () =>
      TE.of(O.getOrElse(() => false)(maybeGetArchived))
    ),
    TE.bind("maximumId", () => TE.of(O.toUndefined(maybeMaximumId))),
    TE.bind("minimumId", () => TE.of(O.toUndefined(maybeMinimumId))),
    TE.chain(
      ({
        pageSize,
        shouldEnrichResultData,
        shouldGetArchivedMessages,
        maximumId,
        minimumId
      }) =>
        pipe(
          messageModel.findMessages(fiscalCode, pageSize, maximumId, minimumId),
          TE.mapLeft(failure => ResponseErrorQuery(failure.kind, failure)),
          TE.map(i => mapAsyncIterator(i, A.rights)),
          TE.map(i =>
            mapAsyncIterator(i, A.filter(RetrievedNotPendingMessage.is))
          ),
          TE.map(i => mapAsyncIterator(i, A.map(retrievedMessageToPublic))),
          TE.chainW(i =>
            // check whether we should enrich messages or not
            pipe(
              TE.fromPredicate(
                () => shouldEnrichResultData === true,
                () =>
                  // if no enrichment is requested we just wrap messages
                  mapAsyncIterator(
                    i,
                    A.map(async e =>
                      E.right<Error, CreatedMessageWithoutContent>(e)
                    )
                  )
              )(i),
              TE.map(j =>
                mapAsyncIterator(j, async m =>
                  enrichMessagesStatus(context, messageStatusModel)(m)()
                )
              ),
              TE.map(j =>
                mapAsyncIterator(
                  j,
                  A.filter(
                    flow(
                      // never filter away errors
                      E.mapLeft(() => true),
                      E.map(
                        mess => mess.is_archived === shouldGetArchivedMessages
                      ),
                      E.toUnion
                    )
                  )
                )
              ),
              TE.map(j =>
                mapAsyncIterator(j, x => [
                  // Do not enrich messages if errors occurred
                  ...pipe(
                    A.lefts(x),
                    A.map(async y => E.left(y))
                  ),
                  ...enrichMessagesData(
                    context,
                    messageModel,
                    serviceModel,
                    blobService
                  )(A.rights(x))
                ])
              ),
              // we need to make a TaskEither of the Either[] mapped above
              TE.orElse(TE.of),
              TE.map(flattenAsyncIterator),
              TE.chain(_ =>
                TE.tryCatch(
                  () => asyncIteratorToPageArray(_, pageSize),
                  E.toError
                )
              ),
              TE.chain(
                TE.fromPredicate(
                  page => !page.results.some(E.isLeft),
                  () => new Error("Cannot enrich data")
                )
              ),
              TE.map(({ hasMoreResults, results }) =>
                toPageResults(A.rights([...results]), hasMoreResults)
              ),
              TE.mapLeft(e => ResponseErrorInternal(e.message))
            )
          )
        )
    ),
    TE.map(ResponseSuccessJson),
    TE.toUnion
  )();

/**
 * Wraps a GetMessages handler inside an Express request handler.
 */
export const GetMessages = (
  messageModel: MessageModel,
  messageStatusModel: MessageStatusModel,
  serviceModel: ServiceModel,
  blobService: BlobService
): express.RequestHandler => {
  const handler = GetMessagesHandler(
    messageModel,
    messageStatusModel,
    serviceModel,
    blobService
  );
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    OptionalQueryParamMiddleware("page_size", NonNegativeIntegerFromString),
    OptionalQueryParamMiddleware("enrich_result_data", BooleanFromString),
    OptionalQueryParamMiddleware("get_archived", BooleanFromString),
    OptionalQueryParamMiddleware("maximum_id", NonEmptyString),
    OptionalQueryParamMiddleware("minimum_id", NonEmptyString)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
};
