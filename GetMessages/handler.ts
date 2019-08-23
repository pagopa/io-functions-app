import * as express from "express";

import { IResponseErrorValidation } from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import {
  filterResultIterator,
  mapResultIterator
} from "io-functions-commons/dist/src/utils/documentdb";
import { retrievedMessageToPublic } from "io-functions-commons/dist/src/utils/messages";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  IResponseSuccessJsonIterator,
  ResponseJsonIterator
} from "io-functions-commons/dist/src/utils/response";

import { MessageModel } from "io-functions-commons/dist/src/models/message";

import { CreatedMessageWithoutContent } from "io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";

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
) => Promise<
  | IResponseSuccessJsonIterator<CreatedMessageWithoutContent>
  | IResponseErrorValidation
  | IResponseErrorQuery
>;

/**
 * Handles requests for getting all message for a recipient.
 */
export function GetMessagesHandler(
  messageModel: MessageModel
): IGetMessagesHandler {
  return async fiscalCode => {
    const retrievedMessagesIterator = messageModel.findMessages(fiscalCode);
    const validMessagesIterator = filterResultIterator(
      retrievedMessagesIterator,
      // isPending is true when the message has been received from the sender
      // but it's still being processed
      message => message.isPending !== true
    );
    const publicExtendedMessagesIterator = mapResultIterator(
      validMessagesIterator,
      retrievedMessageToPublic
    );
    return ResponseJsonIterator(publicExtendedMessagesIterator);
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
