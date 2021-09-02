import { mapAsyncIterator } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { retrievedMessageToPublic } from "@pagopa/io-functions-commons/dist/src/utils/messages";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import { OptionalParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/optional_param";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  IResponseSuccessJsonIterator,
  ResponseErrorQuery,
  ResponseJsonIterator
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import {
  filterAsyncIterator,
  flattenAsyncIterator
} from "@pagopa/io-functions-commons/dist/src/utils/async";

import {
  MessageModel,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";

import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";

import * as express from "express";
import { isRight } from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";

import { IResponseErrorValidation } from "@pagopa/ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { Option } from "fp-ts/lib/Option";

type RetrievedNotPendingMessage = t.TypeOf<typeof RetrievedNotPendingMessage>;
const RetrievedNotPendingMessage = t.intersection([
  RetrievedMessage,
  t.interface({ isPending: t.literal(false) })
]);

type IGetMessagesHandlerResponse =
  | IResponseSuccessJsonIterator<CreatedMessageWithoutContent>
  | IResponseErrorValidation
  | IResponseErrorQuery;

/**
 * Type of a GetMessages handler.
 *
 * GetMessages expects a FiscalCode as input and returns the Messages
 * as output or a Validation error.
 *
 * TODO: add full results and paging
 */
type IGetMessagesHandler = (
  fiscalCode: FiscalCode,
  maybePageSize: Option<NonNegativeInteger>,
  maybeEnrichResultData: Option<boolean>,
  maybeContinuationToken: Option<NonEmptyString>
) => Promise<IGetMessagesHandlerResponse>;

/**
 * Handles requests for getting all message for a recipient.
 */
export function GetMessagesHandler(
  messageModel: MessageModel
): IGetMessagesHandler {
  return async (
    fiscalCode,
    maybePageSize,
    maybeEnrichResultData,
    maybeContinuationToken
  ) => {
    const pageSize = maybePageSize.getOrElse(100 as NonNegativeInteger);
    const enrichResultData = maybeEnrichResultData.getOrElse(false);
    const continuationToken = maybeContinuationToken.getOrElse(undefined);
    return pipe(
      messageModel.findMessages(fiscalCode),
      TE.map(flattenAsyncIterator),
      TE.map(_ => filterAsyncIterator(_, isRight)),
      TE.map(_ => mapAsyncIterator(_, e => e.right)),
      TE.map(_ => filterAsyncIterator(_, RetrievedNotPendingMessage.is)),
      TE.map(_ => mapAsyncIterator(_, retrievedMessageToPublic)),
      TE.bimap(
        failure => ResponseErrorQuery(failure.kind, failure),
        ResponseJsonIterator
      ),
      TE.toUnion
    )();
  };
}

/**
 * Wraps a GetMessages handler inside an Express request handler.
 */
export function GetMessages(
  messageModel: MessageModel
): express.RequestHandler {
  const handler = GetMessagesHandler(messageModel);
  const middlewaresWrap = withRequestMiddlewares(
    FiscalCodeMiddleware,
    OptionalParamMiddleware("page_size", NonNegativeInteger),
    OptionalParamMiddleware("enrich_result_data", t.boolean),
    OptionalParamMiddleware("continuation_token", NonEmptyString)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
