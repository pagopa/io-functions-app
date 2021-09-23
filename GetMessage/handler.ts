import * as express from "express";

import { isLeft } from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";

import { BlobService } from "azure-storage";

import {
  IResponseErrorForbiddenNotAuthorized,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withoutUndefinedValues } from "@pagopa/ts-commons/lib/types";

import { retrievedMessageToPublic } from "@pagopa/io-functions-commons/dist/src/utils/messages";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import { MessageModel } from "@pagopa/io-functions-commons/dist/src/models/message";

import { Context } from "@azure/functions";
import { CreatedMessageWithContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithContent";
import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { MessageResponseWithContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageResponseWithContent";
import { MessageResponseWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageResponseWithoutContent";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

/**
 * Type of a GetMessage handler.
 *
 * GetMessage expects a FiscalCode and a Message ID as input
 * and returns a Message as output or a Not Found or Validation
 * errors.
 */
type IGetMessageHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  messageId: string
) => Promise<
  // eslint-disable-next-line sonar/max-union-size
  | IResponseSuccessJson<
      MessageResponseWithContent | MessageResponseWithoutContent
    >
  | IResponseErrorNotFound
  | IResponseErrorQuery
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal
>;

/**
 * Handles requests for getting a single message for a recipient.
 */
export function GetMessageHandler(
  messageModel: MessageModel,
  blobService: BlobService
): IGetMessageHandler {
  return async (context, fiscalCode, messageId) => {
    const [errorOrMaybeDocument, errorOrMaybeContent] = await Promise.all([
      messageModel.findMessageForRecipient(
        fiscalCode,
        messageId as NonEmptyString
      )(), // FIXME: decode instead of cast
      messageModel.getContentFromBlob(blobService, messageId)()
    ]);

    if (isLeft(errorOrMaybeDocument)) {
      // the query failed
      return ResponseErrorQuery(
        "Error while retrieving the message",
        errorOrMaybeDocument.left
      );
    }

    const maybeDocument = errorOrMaybeDocument.right;
    if (O.isNone(maybeDocument)) {
      // the document does not exist
      return ResponseErrorNotFound(
        "Message not found",
        "The message that you requested was not found in the system."
      );
    }

    const retrievedMessage = maybeDocument.value;

    if (isLeft(errorOrMaybeContent)) {
      context.log.error(
        `GetMessageHandler|${JSON.stringify(errorOrMaybeContent.left)}`
      );
      return ResponseErrorInternal(
        `${errorOrMaybeContent.left.name}: ${errorOrMaybeContent.left.message}`
      );
    }

    const maybeContent = errorOrMaybeContent.right;

    const message:
      | CreatedMessageWithContent
      | CreatedMessageWithoutContent = withoutUndefinedValues({
      content: O.toUndefined(maybeContent),
      ...retrievedMessageToPublic(retrievedMessage)
    });

    const returnedMessage:
      | MessageResponseWithContent
      | MessageResponseWithoutContent = {
      message
    };

    return ResponseSuccessJson(returnedMessage);
  };
}

/**
 * Wraps a GetMessage handler inside an Express request handler.
 */
export function GetMessage(
  messageModel: MessageModel,
  blobService: BlobService
): express.RequestHandler {
  const handler = GetMessageHandler(messageModel, blobService);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("id", NonEmptyString)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
