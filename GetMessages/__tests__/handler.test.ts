// tslint:disable:no-any no-duplicate-string no-big-function

import { right } from "fp-ts/lib/Either";

import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import {
  NewMessageWithoutContent,
  RetrievedMessageWithoutContent
} from "@pagopa/io-functions-commons/dist/src/models/message";

import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "@pagopa/io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";

import { response as MockResponse } from "jest-mock-express";

import { taskEither } from "fp-ts/lib/TaskEither";
import { aCosmosResourceMetadata } from "../../__mocks__/mocks";
import { GetMessagesHandler } from "../handler";
import { none } from "fp-ts/lib/Option";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aMessageId = "A_MESSAGE_ID" as NonEmptyString;
const aPendingMessageId = "A_PENDING_MESSAGE_ID" as NonEmptyString;

const aNewMessageWithoutContent: NewMessageWithoutContent = {
  createdAt: new Date(),
  fiscalCode: aFiscalCode,
  id: aMessageId,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  isPending: false,
  kind: "INewMessageWithoutContent",
  senderServiceId: "test" as ServiceId,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

const aRetrievedMessageWithoutContent: RetrievedMessageWithoutContent = {
  ...aNewMessageWithoutContent,
  ...aCosmosResourceMetadata,
  kind: "IRetrievedMessageWithoutContent"
};

const aRetrievedPendingMessageWithoutContent: RetrievedMessageWithoutContent = {
  ...aNewMessageWithoutContent,
  ...aCosmosResourceMetadata,
  id: aPendingMessageId,
  isPending: true,
  kind: "IRetrievedMessageWithoutContent"
};

describe("GetMessagesHandler", () => {
  it("should respond with the messages for the recipient", async () => {
    const mockIterator = {
      next: jest
        .fn()
        .mockImplementationOnce(async () => ({
          value: [right(aRetrievedMessageWithoutContent)]
        }))
        .mockImplementationOnce(async () => ({ done: true }))
    };

    const mockMessageModel = {
      findMessages: jest.fn(() => taskEither.of(mockIterator))
    };

    const getMessagesHandler = GetMessagesHandler(mockMessageModel as any);

    const result = await getMessagesHandler(aFiscalCode, none, none, none);
    expect(result.kind).toBe("IResponseSuccessJsonIterator");

    const mockResponse = MockResponse();
    await result.apply(mockResponse);

    expect(mockIterator.next).toHaveBeenCalledTimes(2);
  });

  it("should respondonly with non-pending messages", async () => {
    const mockIterator = {
      next: jest
        .fn()
        .mockImplementationOnce(async () => ({
          value: [
            right(aRetrievedMessageWithoutContent),
            right(aRetrievedPendingMessageWithoutContent)
          ]
        }))
        .mockImplementationOnce(async () => ({ done: true }))
    };

    const mockMessageModel = {
      findMessages: jest.fn(() => taskEither.of(mockIterator))
    };

    const getMessagesHandler = GetMessagesHandler(mockMessageModel as any);

    const result = await getMessagesHandler(aFiscalCode, none, none, none);
    expect(result.kind).toBe("IResponseSuccessJsonIterator");

    const mockResponse = MockResponse();
    await result.apply(mockResponse);

    expect(mockResponse.json).toHaveBeenCalledWith({
      items: [expect.objectContaining({ id: aMessageId })],
      page_size: 1
    });
    expect(mockIterator.next).toHaveBeenCalledTimes(2);
  });
});
