// tslint:disable:no-any no-duplicate-string no-big-function

import { right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";

import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";

import {
  NewMessageWithoutContent,
  RetrievedMessageWithoutContent
} from "io-functions-commons/dist/src/models/message";

import { ServiceId } from "io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";

import { response as MockResponse } from "jest-mock-express";

import { taskEither } from "fp-ts/lib/TaskEither";
import { GetMessagesHandler } from "../handler";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aNewMessageWithoutContent: NewMessageWithoutContent = {
  createdAt: new Date(),
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
  /*   _self: "xyz",
  _ts: 1, */
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

    const result = await getMessagesHandler(aFiscalCode);
    expect(result.kind).toBe("IResponseSuccessJsonIterator");

    const mockResponse = MockResponse();
    await result.apply(mockResponse);

    expect(mockIterator.next).toHaveBeenCalledTimes(2);
  });
});
