import * as express from "express";

import * as E from "fp-ts/lib/Either";
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
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { ServiceModel } from "@pagopa/io-functions-commons/dist/src/models/service";
import { pipe } from "fp-ts/lib/function";
import { PaymentDataWithRequiredPayee } from "@pagopa/io-functions-commons/dist/generated/definitions/PaymentDataWithRequiredPayee";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { MessageResponseWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageResponseWithoutContent";
import { CreatedMessageWithContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithContent";
import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { PaymentData } from "@pagopa/io-functions-commons/dist/generated/definitions/PaymentData";
import { MessageResponseWithContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageResponseWithContent";

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
  | IResponseSuccessJson<
      MessageResponseWithContent | MessageResponseWithoutContent
    >
  | IResponseErrorNotFound
  | IResponseErrorQuery
  | IResponseErrorValidation
  | IResponseErrorForbiddenNotAuthorized
  | IResponseErrorInternal
>;

const getErrorOrPaymentData = async (
  context: Context,
  serviceModel: ServiceModel,
  senderServiceId: ServiceId,
  maybePaymentData: O.Option<PaymentData>
): Promise<E.Either<IResponseErrorInternal, O.Option<PaymentData>>> => {
  if (
    O.isSome(maybePaymentData) &&
    !PaymentDataWithRequiredPayee.is(maybePaymentData.value)
  ) {
    const errorOrMaybeSenderService = await serviceModel.findLastVersionByModelId(
      [senderServiceId]
    )();
    if (E.isLeft(errorOrMaybeSenderService)) {
      context.log.error(
        `GetMessageHandler|${JSON.stringify(errorOrMaybeSenderService.left)}`
      );
      return E.left<IResponseErrorInternal, O.Option<PaymentData>>(
        ResponseErrorInternal(
          `Cannot get message Sender Service|ERROR=${
            E.toError(errorOrMaybeSenderService.left).message
          }`
        )
      );
    }
    const maybeSenderService = errorOrMaybeSenderService.right;
    if (O.isNone(maybeSenderService)) {
      // the message sender service does not exist
      return E.left<IResponseErrorInternal, O.Option<PaymentData>>(
        ResponseErrorInternal(
          `Message Sender not found The message that you requested does not have a related sender service`
        )
      );
    }
    return E.right<IResponseErrorInternal, O.Option<PaymentData>>(
      O.some({
        ...maybePaymentData.value,
        payee: {
          fiscal_code: maybeSenderService.value.organizationFiscalCode
        }
      })
    );
  }
  return E.right<IResponseErrorInternal, O.Option<PaymentData>>(
    maybePaymentData
  );
};
/**
 * Handles requests for getting a single message for a recipient.
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function GetMessageHandler(
  messageModel: MessageModel,
  blobService: BlobService,
  serviceModel: ServiceModel
): IGetMessageHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async (context, fiscalCode, messageId) => {
    const [errorOrMaybeDocument, errorOrMaybeContent] = await Promise.all([
      messageModel.findMessageForRecipient(
        fiscalCode,
        messageId as NonEmptyString
      )(), // FIXME: decode instead of cast
      messageModel.getContentFromBlob(blobService, messageId)()
    ]);

    if (E.isLeft(errorOrMaybeDocument)) {
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

    if (E.isLeft(errorOrMaybeContent)) {
      context.log.error(
        `GetMessageHandler|${JSON.stringify(errorOrMaybeContent.left)}`
      );
      return ResponseErrorInternal(
        `${errorOrMaybeContent.left.name}: ${errorOrMaybeContent.left.message}`
      );
    }

    const maybeContent = errorOrMaybeContent.right;

    const maybePaymentData = pipe(
      maybeContent,
      O.chainNullableK(content => content.payment_data)
    );

    const errorOrMaybePaymentData = await getErrorOrPaymentData(
      context,
      serviceModel,
      retrievedMessage.senderServiceId,
      maybePaymentData
    );
    if (E.isLeft(errorOrMaybePaymentData)) {
      return errorOrMaybePaymentData.left;
    }

    const message:
      | CreatedMessageWithContent
      | CreatedMessageWithoutContent = withoutUndefinedValues({
      content: pipe(
        maybeContent,
        O.map(content => ({
          ...content,
          payment_data: O.toUndefined(errorOrMaybePaymentData.right)
        })),
        O.toUndefined
      ),
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
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function GetMessage(
  messageModel: MessageModel,
  blobService: BlobService,
  serviceModel: ServiceModel
): express.RequestHandler {
  const handler = GetMessageHandler(messageModel, blobService, serviceModel);
  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("id", NonEmptyString)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
