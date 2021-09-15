// tslint:disable: ordered-imports
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
import { IResponseErrorQuery } from "@pagopa/io-functions-commons/dist/src/utils/response";
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
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
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
import { enrichMessagesData } from "../utils/messages";

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
                  // A.map(e => TE.of<Error, CreatedMessageWithoutContent>(e))
                  A.map(async e =>
                    E.right<Error, CreatedMessageWithoutContent>(e)
                  )
                )
            )(i),
            TE.map(j =>
              mapAsyncIterator(
                j,
                enrichMessagesData(messageModel, serviceModel, blobService)
              )
            ),
            TE.orElse(TE.of)
          )
        ),
        TE.map(flattenAsyncIterator),
        TE.chain(i =>
          TE.tryCatch(() => asyncIteratorToPageArray(i, pageSize), E.toError)
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
        TE.bimap(e => ResponseErrorInternal(e.message), ResponseSuccessJson),
        TE.toUnion
      )()
    )
  )();

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
