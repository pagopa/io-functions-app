// tslint:disable:no-any no-duplicate-string no-big-function

import { left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";

import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";

import {
  NewMessageWithoutContent,
  RetrievedMessageWithoutContent
} from "io-functions-commons/dist/src/models/message";

import { CreatedMessageWithoutContent } from "io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { MessageResponseWithoutContent } from "io-functions-commons/dist/generated/definitions/MessageResponseWithoutContent";
import { ServiceId } from "io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";

import { context as contextMock } from "../../__mocks__/durable-functions";
import { GetMessageHandler } from "../handler";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aDate = new Date();

const aNewMessageWithoutContent: NewMessageWithoutContent = {
  createdAt: aDate,
  fiscalCode: aFiscalCode,
  id: "A_MESSAGE_ID" as NonEmptyString,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  isPending: true,
  kind: "INewMessageWithoutContent",
  senderServiceId: "test" as ServiceId,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

const aRetrievedMessageWithoutContent: RetrievedMessageWithoutContent = {
  ...aNewMessageWithoutContent,
  _self: "xyz",
  _ts: 1,
  kind: "IRetrievedMessageWithoutContent"
};

const aPublicExtendedMessage: CreatedMessageWithoutContent = {
  created_at: aDate,
  fiscal_code: aNewMessageWithoutContent.fiscalCode,
  id: "A_MESSAGE_ID",
  sender_service_id: aNewMessageWithoutContent.senderServiceId
};

const aPublicExtendedMessageResponse: MessageResponseWithoutContent = {
  message: aPublicExtendedMessage
};

describe("GetMessageHandler", () => {
  it("should fail if any error occurs trying to retrieve the message content", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() =>
        right(some(aRetrievedMessageWithoutContent))
      ),
      getContentFromBlob: jest.fn(() => left(new Error()))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any
    );

    const result = await getMessageHandler(
      contextMock as any,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessageWithoutContent.fiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseErrorInternal");
  });

  it("should respond with a message", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() =>
        right(some(aRetrievedMessageWithoutContent))
      ),
      getContentFromBlob: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any
    );

    const result = await getMessageHandler(
      contextMock as any,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessageWithoutContent.fiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aPublicExtendedMessageResponse);
    }
  });

  it("should respond with not found a message doesn not exist", async () => {
    const mockMessageModel = {
      findMessageForRecipient: jest.fn(() => right(none)),
      getContentFromBlob: jest.fn(() => right(none))
    };

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any
    );

    const result = await getMessageHandler(
      contextMock as any,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);

    expect(result.kind).toBe("IResponseErrorNotFound");
  });
});
