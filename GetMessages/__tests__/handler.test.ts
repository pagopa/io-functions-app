// tslint:disable:no-any no-duplicate-string no-big-function

import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import {
  NewMessageWithoutContent,
  RetrievedMessageWithoutContent
} from "@pagopa/io-functions-commons/dist/src/models/message";

import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "@pagopa/io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";

import { response as MockResponse } from "jest-mock-express";

import { aCosmosResourceMetadata } from "../../__mocks__/mocks";
import { GetMessagesHandler } from "../handler";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { aServiceId } from "../../__mocks__/mocks.service_preference";
import { boolean } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";

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
  senderServiceId: aServiceId,
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
  it("should respond with the messages for the recipient when no parameters are given", async () => {
    const mockIterator = {
      next: jest
        .fn()
        .mockImplementationOnce(async () => ({
          value: [E.right(aRetrievedMessageWithoutContent)]
        }))
        .mockImplementationOnce(async () => ({ done: true }))
    };

    const mockMessageModel = {
      findMessages: jest.fn(() => TE.of(mockIterator))
    };

    const getMessagesHandler = GetMessagesHandler(mockMessageModel as any);

    const result = await getMessagesHandler(
      aFiscalCode,
      O.none,
      O.none,
      O.none,
      O.none
    );
    expect(result.kind).toBe("IResponseSuccessPageIdBasedIterator");

    const mockResponse = MockResponse();
    await result.apply(mockResponse);

    expect(mockIterator.next).toHaveBeenCalledTimes(2);
  });

  it("should respond only with non-pending messages", async () => {
    const mockIterator = {
      next: jest
        .fn()
        .mockImplementationOnce(async () => ({
          value: [
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedPendingMessageWithoutContent)
          ]
        }))
        .mockImplementationOnce(async () => ({ done: true }))
    };

    const mockMessageModel = {
      findMessages: jest.fn(() => TE.of(mockIterator))
    };

    const getMessagesHandler = GetMessagesHandler(mockMessageModel as any);

    const result = await getMessagesHandler(
      aFiscalCode,
      O.none,
      O.none,
      O.none,
      O.none
    );
    expect(result.kind).toBe("IResponseSuccessPageIdBasedIterator");

    const mockResponse = MockResponse();
    await result.apply(mockResponse);

    expect(mockResponse.json).toHaveBeenCalledWith({
      hasMoreResults: false,
      items: [expect.objectContaining({ id: aMessageId })],
      page_size: 1,
      prev: aRetrievedMessageWithoutContent.id
    });
    expect(mockIterator.next).toHaveBeenCalledTimes(2);
  });

  it("should respond with given page size when it is given", async () => {
    const mockIterator = {
      next: jest
        .fn()
        .mockImplementationOnce(async () => ({
          value: [
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedPendingMessageWithoutContent)
          ]
        }))
        .mockImplementationOnce(async () => ({ done: true }))
    };

    const mockMessageModel = {
      findMessages: jest.fn(() => TE.of(mockIterator))
    };

    const getMessagesHandler = GetMessagesHandler(mockMessageModel as any);

    const pageSize = 2 as NonNegativeInteger;

    const result = await getMessagesHandler(
      aFiscalCode,
      O.some(pageSize),
      O.none,
      O.none,
      O.none
    );
    expect(result.kind).toBe("IResponseSuccessPageIdBasedIterator");

    const mockResponse = MockResponse();
    await result.apply(mockResponse);

    expect(mockResponse.json).toHaveBeenCalledWith({
      hasMoreResults: true,
      items: expect.arrayContaining([
        expect.objectContaining({
          fiscal_code: aFiscalCode,
          id: aRetrievedMessageWithoutContent.id,
          sender_service_id: aServiceId,
          created_at: expect.any(Date)
        })
      ]),
      page_size: pageSize,
      next: aRetrievedMessageWithoutContent.id,
      prev: aRetrievedMessageWithoutContent.id
    });
    expect(mockIterator.next).toHaveBeenCalledTimes(1);
  });

  it("should respond with a page of messages when given maximum id", async () => {
    const mockIterator = {
      next: jest
        .fn()
        .mockImplementationOnce(async () => ({
          value: [
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedPendingMessageWithoutContent)
          ]
        }))
        .mockImplementationOnce(async () => ({ done: true }))
    };

    const mockMessageModel = {
      findMessages: jest.fn(() => TE.of(mockIterator))
    };

    const getMessagesHandler = GetMessagesHandler(mockMessageModel as any);

    const pageSize = 2 as NonNegativeInteger;

    const result = await getMessagesHandler(
      aFiscalCode,
      O.some(pageSize),
      O.none,
      O.some(aRetrievedMessageWithoutContent.id),
      O.none
    );
    expect(result.kind).toBe("IResponseSuccessPageIdBasedIterator");

    const mockResponse = MockResponse();
    await result.apply(mockResponse);

    expect(mockResponse.json).toHaveBeenCalledWith({
      hasMoreResults: true,
      items: expect.arrayContaining([
        expect.objectContaining({
          fiscal_code: aFiscalCode,
          id: aRetrievedMessageWithoutContent.id,
          sender_service_id: aServiceId,
          created_at: expect.any(Date)
        })
      ]),
      page_size: pageSize,
      next: aRetrievedMessageWithoutContent.id,
      prev: aRetrievedMessageWithoutContent.id
    });
    expect(mockIterator.next).toHaveBeenCalledTimes(1);
  });

  it("should respond with a page of messages above given minimum id", async () => {
    const mockIterator = {
      next: jest
        .fn()
        .mockImplementationOnce(async () => ({
          value: [
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedPendingMessageWithoutContent)
          ]
        }))
        .mockImplementationOnce(async () => ({ done: true }))
    };

    const mockMessageModel = {
      findMessages: jest.fn(() => TE.of(mockIterator))
    };

    const getMessagesHandler = GetMessagesHandler(mockMessageModel as any);

    const pageSize = 2 as NonNegativeInteger;

    const result = await getMessagesHandler(
      aFiscalCode,
      O.some(pageSize),
      O.none,
      O.none,
      O.some(aRetrievedMessageWithoutContent.id)
    );
    expect(result.kind).toBe("IResponseSuccessPageIdBasedIterator");

    const mockResponse = MockResponse();
    await result.apply(mockResponse);

    expect(mockResponse.json).toHaveBeenCalledWith({
      hasMoreResults: true,
      items: expect.arrayContaining([
        expect.objectContaining({
          fiscal_code: aFiscalCode,
          id: aRetrievedMessageWithoutContent.id,
          sender_service_id: aServiceId,
          created_at: expect.any(Date)
        })
      ]),
      page_size: pageSize,
      next: aRetrievedMessageWithoutContent.id,
      prev: aRetrievedMessageWithoutContent.id
    });
    expect(mockIterator.next).toHaveBeenCalledTimes(1);
  });

  it("should respond with a page of messages above given enrichment parameter", async () => {
    const mockIterator = {
      next: jest
        .fn()
        .mockImplementationOnce(async () => ({
          value: [
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedMessageWithoutContent),
            E.right(aRetrievedPendingMessageWithoutContent)
          ]
        }))
        .mockImplementationOnce(async () => ({ done: true }))
    };

    const mockMessageModel = {
      findMessages: jest.fn(() => TE.of(mockIterator))
    };

    const getMessagesHandler = GetMessagesHandler(mockMessageModel as any);

    const pageSize = 2 as NonNegativeInteger;

    const result = await getMessagesHandler(
      aFiscalCode,
      O.some(pageSize),
      O.some(true),
      O.none,
      O.none
    );
    expect(result.kind).toBe("IResponseSuccessPageIdBasedIterator");

    const mockResponse = MockResponse();
    await result.apply(mockResponse);

    expect(mockResponse.json).toHaveBeenCalledWith({
      hasMoreResults: true,
      items: expect.arrayContaining([
        expect.objectContaining({
          fiscal_code: aFiscalCode,
          id: aRetrievedMessageWithoutContent.id,
          sender_service_id: aServiceId,
          created_at: expect.any(Date)
        })
      ]),
      page_size: pageSize,
      next: aRetrievedMessageWithoutContent.id,
      prev: aRetrievedMessageWithoutContent.id
    });
    expect(mockIterator.next).toHaveBeenCalledTimes(1);
  });
});
