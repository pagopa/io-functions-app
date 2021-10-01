// eslint-disable @typescript-eslint/no-explicit-any, sonarjs/no-duplicate-string, sonar/sonar-max-lines-per-function

import * as O from "fp-ts/lib/Option";

import {
  FiscalCode,
  NonEmptyString,
  OrganizationFiscalCode
} from "@pagopa/ts-commons/lib/strings";

import {
  NewMessageWithoutContent,
  RetrievedMessageWithoutContent
} from "@pagopa/io-functions-commons/dist/src/models/message";

import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { MessageResponseWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageResponseWithoutContent";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "@pagopa/io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";

import * as TE from "fp-ts/lib/TaskEither";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { aCosmosResourceMetadata } from "../../__mocks__/mocks";
import { GetMessageHandler } from "../handler";
import { Service } from "@pagopa/io-functions-commons/dist/src/models/service";
import { aRetrievedService } from "../../__mocks__/mocks.service_preference";
import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";
import { PaymentData } from "../../generated/backend/PaymentData";
import { PaymentAmount } from "../../generated/backend/PaymentAmount";
import { PaymentNoticeNumber } from "../../generated/backend/PaymentNoticeNumber";
import { MessageBodyMarkdown } from "../../generated/backend/MessageBodyMarkdown";
import { MessageSubject } from "../../generated/backend/MessageSubject";

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
  ...aCosmosResourceMetadata,
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

const aSenderService: Service = {
  ...aRetrievedService,
  organizationFiscalCode: "12345678901" as OrganizationFiscalCode
};
const aPaymentDataWithoutPayee: PaymentData = {
  amount: 1000 as PaymentAmount,
  notice_number: "1777777777777777" as PaymentNoticeNumber
};

const aPaymentMessageContent: MessageContent = {
  markdown: "a".repeat(81) as MessageBodyMarkdown,
  subject: "sub".repeat(10) as MessageSubject
};

const serviceFindLastVersionByModelIdMock = jest
  .fn()
  .mockImplementation(() => TE.of(O.some(aSenderService)));
const mockServiceModel = {
  findLastVersionByModelId: serviceFindLastVersionByModelIdMock
};

const findMessageForRecipientMock = jest
  .fn()
  .mockImplementation(() => TE.of(O.some(aRetrievedMessageWithoutContent)));

const getContentFromBlobMock = jest
  .fn()
  .mockImplementation(() => TE.of(O.none));
const mockMessageModel = {
  findMessageForRecipient: findMessageForRecipientMock,
  getContentFromBlob: getContentFromBlobMock
};

describe("GetMessageHandler", () => {
  afterEach(() => jest.clearAllMocks());
  it("should fail if any error occurs trying to retrieve the message content", async () => {
    getContentFromBlobMock.mockImplementationOnce(() => TE.left(new Error()));

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any,
      mockServiceModel as any
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
    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any,
      mockServiceModel as any
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

  it("should respond with a message with eu_covid_cert", async () => {
    const aRetrievedMessageWithEuCovidCert = {
      ...aRetrievedMessageWithoutContent,
      content: {
        eu_covid_cert: {
          auth_code: "ACode"
        },
        markdown: "m".repeat(80),
        subject: "e".repeat(80)
      },
      kind: "IRetrievedMessageWithContent"
    };

    const expected = {
      ...aPublicExtendedMessage,
      content: aRetrievedMessageWithEuCovidCert.content
    };

    findMessageForRecipientMock.mockImplementationOnce(() =>
      TE.of(O.some(aRetrievedMessageWithEuCovidCert))
    );
    getContentFromBlobMock.mockImplementationOnce(() =>
      TE.of(O.some(aRetrievedMessageWithEuCovidCert.content))
    );

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any,
      mockServiceModel as any
    );

    const result = await getMessageHandler(
      contextMock as any,
      aFiscalCode,
      aRetrievedMessageWithEuCovidCert.id
    );

    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledWith(
      aRetrievedMessageWithEuCovidCert.fiscalCode,
      aRetrievedMessageWithEuCovidCert.id
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value.message).toEqual(
        expect.objectContaining({
          ...expected
        })
      );
    }
  });

  it("should respond with not found a message doesn not exist", async () => {
    findMessageForRecipientMock.mockImplementationOnce(() => TE.of(O.none));

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any,
      mockServiceModel as any
    );

    const result = await getMessageHandler(
      contextMock as any,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);

    expect(result.kind).toBe("IResponseErrorNotFound");
  });

  it("should respond with a message payment data overriden with payee if original content does not have a payee", async () => {
    getContentFromBlobMock.mockImplementationOnce(() =>
      TE.of(
        O.some({
          ...aPaymentMessageContent,
          payment_data: aPaymentDataWithoutPayee
        })
      )
    );

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any,
      mockServiceModel as any
    );

    const result = await getMessageHandler(
      contextMock as any,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(1);
    expect(mockServiceModel.findLastVersionByModelId).toHaveBeenCalledTimes(1);

    const expected = {
      ...aPublicExtendedMessage,
      content: {
        ...aPaymentMessageContent,
        payment_data: {
          ...aPaymentDataWithoutPayee,
          payee: {
            fiscal_code: aSenderService.organizationFiscalCode
          }
        }
      }
    };

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value.message).toEqual(expected);
    }
  });

  it("should respond with an internal error if message sender cannot be retrieved", async () => {
    getContentFromBlobMock.mockImplementationOnce(() =>
      TE.of(
        O.some({
          ...aPaymentMessageContent,
          payment_data: aPaymentDataWithoutPayee
        })
      )
    );
    serviceFindLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.left(new Error("Cannot query services"))
    );

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any,
      mockServiceModel as any
    );

    const result = await getMessageHandler(
      contextMock as any,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(1);
    expect(mockServiceModel.findLastVersionByModelId).toHaveBeenCalledTimes(1);

    expect(result.kind).toBe("IResponseErrorInternal");
  });

  it("should respond with an internal error if message sender cannot be found", async () => {
    getContentFromBlobMock.mockImplementationOnce(() =>
      TE.of(
        O.some({
          ...aPaymentMessageContent,
          payment_data: aPaymentDataWithoutPayee
        })
      )
    );
    serviceFindLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.of(O.none)
    );

    const getMessageHandler = GetMessageHandler(
      mockMessageModel as any,
      {} as any,
      mockServiceModel as any
    );

    const result = await getMessageHandler(
      contextMock as any,
      aFiscalCode,
      aRetrievedMessageWithoutContent.id
    );

    expect(mockMessageModel.findMessageForRecipient).toHaveBeenCalledTimes(1);
    expect(mockMessageModel.getContentFromBlob).toHaveBeenCalledTimes(1);
    expect(mockServiceModel.findLastVersionByModelId).toHaveBeenCalledTimes(1);

    expect(result.kind).toBe("IResponseErrorInternal");
  });
});
