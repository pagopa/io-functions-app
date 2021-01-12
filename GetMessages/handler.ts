import * as express from "express";
import * as t from "io-ts";

import { IResponseErrorValidation } from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { mapAsyncIterator } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { retrievedMessageToPublic } from "@pagopa/io-functions-commons/dist/src/utils/messages";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";
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

import { isRight } from "fp-ts/lib/Either";
import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";

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
  fiscalCode: FiscalCode
) => Promise<IGetMessagesHandlerResponse>;

/**
 * Handles requests for getting all message for a recipient.
 */
export function GetMessagesHandler(
  messageModel: MessageModel
): IGetMessagesHandler {
  return async fiscalCode => {
    return messageModel
      .findMessages(fiscalCode)
      .map(flattenAsyncIterator)
      .map(_ => filterAsyncIterator(_, isRight))
      .map(_ => mapAsyncIterator(_, e => e.value))
      .map(_ => filterAsyncIterator(_, RetrievedNotPendingMessage.is))
      .map(_ => mapAsyncIterator(_, retrievedMessageToPublic))
      .fold<IGetMessagesHandlerResponse>(
        failure => ResponseErrorQuery(failure.kind, failure),
        ResponseJsonIterator
      )
      .run();
  };
}

/**
 * Wraps a GetMessages handler inside an Express request handler.
 */
export function GetMessages(
  messageModel: MessageModel
): express.RequestHandler {
  const handler = GetMessagesHandler(messageModel);
  const middlewaresWrap = withRequestMiddlewares(FiscalCodeMiddleware);
  return wrapRequestHandler(middlewaresWrap(handler));
}
