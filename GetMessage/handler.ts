import * as express from "express";
import * as winston from "winston";

import { isLeft } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";

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
} from "italia-ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";
import { withoutUndefinedValues } from "italia-ts-commons/lib/types";

import {
  getMessageNotificationStatuses,
  retrievedMessageToPublic
} from "io-functions-commons/dist/src/utils/messages";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import { RequiredParamMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_param";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "io-functions-commons/dist/src/utils/response";

import { MessageModel } from "io-functions-commons/dist/src/models/message";
import { NotificationModel } from "io-functions-commons/dist/src/models/notification";

import { MessageStatusModel } from "io-functions-commons/dist/src/models/message_status";
import { NotificationStatusModel } from "io-functions-commons/dist/src/models/notification_status";

import { CreatedMessageWithContent } from "io-functions-commons/dist/generated/definitions/CreatedMessageWithContent";
import { CreatedMessageWithoutContent } from "io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { MessageResponseWithContent } from "io-functions-commons/dist/generated/definitions/MessageResponseWithContent";
import { MessageResponseWithoutContent } from "io-functions-commons/dist/generated/definitions/MessageResponseWithoutContent";
import { MessageStatusValueEnum } from "io-functions-commons/dist/generated/definitions/MessageStatusValue";

/**
 * Type of a GetMessage handler.
 *
 * GetMessage expects a FiscalCode and a Message ID as input
 * and returns a Message as output or a Not Found or Validation
 * errors.
 */
type IGetMessageHandler = (
  fiscalCode: FiscalCode,
  messageId: string
) => Promise<
  // tslint:disable-next-line:max-union-size
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
  return async (fiscalCode, messageId) => {
    const errorOrMaybeDocument = await messageModel.findMessageForRecipient(
      fiscalCode,
      messageId
    );

    if (isLeft(errorOrMaybeDocument)) {
      // the query failed
      return ResponseErrorQuery(
        "Error while retrieving the message",
        errorOrMaybeDocument.value
      );
    }

    const maybeDocument = errorOrMaybeDocument.value;
    if (isNone(maybeDocument)) {
      // the document does not exist
      return ResponseErrorNotFound(
        "Message not found",
        "The message that you requested was not found in the system."
      );
    }

    const retrievedMessage = maybeDocument.value;

    // fetch the content of the message from the blob storage
    const errorOrMaybeContent = await messageModel.getStoredContent(
      blobService,
      messageId,
      fiscalCode
    );

    if (isLeft(errorOrMaybeContent)) {
      winston.error(
        `GetMessageHandler|${JSON.stringify(errorOrMaybeContent.value)}`
      );
      return ResponseErrorInternal(
        `${errorOrMaybeContent.value.name}: ${errorOrMaybeContent.value.message}`
      );
    }

    const maybeContent = errorOrMaybeContent.value;

    const message:
      | CreatedMessageWithContent
      | CreatedMessageWithoutContent = withoutUndefinedValues({
      content: maybeContent.toUndefined(),
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
    FiscalCodeMiddleware,
    RequiredParamMiddleware("id", NonEmptyString)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
