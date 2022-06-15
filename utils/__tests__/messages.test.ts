import { MaxAllowedPaymentAmount } from "@pagopa/io-functions-commons/dist/generated/definitions/MaxAllowedPaymentAmount";
import {
  NewService,
  RetrievedService,
  Service,
  ServiceModel,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  FiscalCode,
  NonEmptyString,
  OrganizationFiscalCode
} from "@pagopa/ts-commons/lib/strings";
import { aCosmosResourceMetadata } from "../../__mocks__/mocks";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { BlobService } from "azure-storage";
import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";
import {
  CreatedMessageWithoutContentWithStatus,
  enrichMessagesData
} from "../messages";
import {
  MessageModel,
  NewMessageWithoutContent,
  RetrievedMessageWithoutContent
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../generated/backend/TimeToLiveSeconds";
import { retrievedMessageToPublic } from "@pagopa/io-functions-commons/dist/src/utils/messages";
import { EnrichedMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/EnrichedMessage";
import { pipe } from "fp-ts/lib/function";
import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { Context } from "@azure/functions";
import { toCosmosErrorResponse } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { TagEnum as TagEnumBase } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageCategoryBase";
import { TagEnum as TagEnumPayment } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageCategoryPayment";
import { FeatureLevelTypeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/FeatureLevelType";

const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;

const aService: Service = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDeptName" as NonEmptyString,
  isVisible: true,
  maxAllowedPaymentAmount: 0 as MaxAllowedPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyOrgName" as NonEmptyString,
  requireSecureChannels: false,
  serviceId: "MySubscriptionId" as NonEmptyString,
  serviceName: "MyServiceName" as NonEmptyString
};

const aNewService: NewService = {
  ...aService,
  kind: "INewService"
};

const aRetrievedService: RetrievedService = {
  ...aNewService,
  ...aCosmosResourceMetadata,
  id: "123" as NonEmptyString,
  kind: "IRetrievedService",
  version: 1 as NonNegativeInteger
};

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const aDate = new Date();

const aNewMessageWithoutContent: NewMessageWithoutContent = {
  createdAt: aDate,
  featureLevelType: FeatureLevelTypeEnum.STANDARD,
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

const blobServiceMock = ({
  getBlobToText: jest.fn()
} as unknown) as BlobService;

const mockedGenericContent = {
  subject: "a subject",
  markdown: "a markdown"
} as MessageContent;

const mockedGreenPassContent = {
  subject: "a subject".repeat(10),
  markdown: "a markdown".repeat(80),
  eu_covid_cert: {
    auth_code: "an_auth_code"
  }
} as MessageContent;

const mockedLegalDataContent = {
  subject: "a subject".repeat(10),
  markdown: "a markdown".repeat(80),
  legal_data: {
    has_attachment: false,
    message_unique_id: "dummy_mvl_id",
    sender_mail_from: "dummy@sender.it"
  }
} as MessageContent;

const mockedPaymentContent = {
  subject: "a subject".repeat(10),
  markdown: "a markdown".repeat(80),
  payment_data: {
    amount: 1,
    notice_number: "012345678901234567"
  }
} as MessageContent;

const getContentFromBlobMock = jest
  .fn()
  .mockImplementation(() => TE.of(O.some(mockedGenericContent)));

const messageModelMock = ({
  getContentFromBlob: getContentFromBlobMock
} as unknown) as MessageModel;

const findLastVersionByModelIdMock = jest
  .fn()
  .mockImplementation(() => TE.of(O.some(aRetrievedService)));
const serviceModelMock = ({
  findLastVersionByModelId: findLastVersionByModelIdMock
} as unknown) as ServiceModel;

const functionsContextMock = ({
  log: {
    error: jest.fn(e => console.log(e))
  }
} as unknown) as Context;

const messages = [
  {
    ...retrievedMessageToPublic(aRetrievedMessageWithoutContent),
    is_archived: false,
    is_read: false
  }
] as readonly CreatedMessageWithoutContentWithStatus[];

// ------------------------
// Tests
// ------------------------

describe("enrichMessagesData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return right when message blob and service are correctly retrieved", async () => {
    const enrichMessages = enrichMessagesData(
      functionsContextMock,
      messageModelMock,
      serviceModelMock,
      blobServiceMock
    );

    const enrichedMessagesPromises = enrichMessages(messages);

    const enrichedMessages = await pipe(
      TE.tryCatch(async () => Promise.all(enrichedMessagesPromises), void 0),
      TE.getOrElse(() => {
        throw Error();
      })
    )();

    enrichedMessages.map(enrichedMessage => {
      expect(E.isRight(enrichedMessage)).toBe(true);
      if (E.isRight(enrichedMessage)) {
        expect(EnrichedMessage.is(enrichedMessage.right)).toBe(true);
        expect(enrichedMessage.right.category).toEqual({
          tag: TagEnumBase.GENERIC
        });
      }
    });
    expect(functionsContextMock.log.error).not.toHaveBeenCalled();
  });

  it("should return right with right message EU_COVID_CERT category when message content is retrieved", async () => {
    getContentFromBlobMock.mockImplementationOnce(() =>
      TE.of(O.some(mockedGreenPassContent))
    );
    const enrichMessages = enrichMessagesData(
      functionsContextMock,
      messageModelMock,
      serviceModelMock,
      blobServiceMock
    );

    const enrichedMessagesPromises = enrichMessages(messages);

    const enrichedMessages = await pipe(
      TE.tryCatch(async () => Promise.all(enrichedMessagesPromises), void 0),
      TE.getOrElse(() => {
        throw Error();
      })
    )();

    enrichedMessages.map(enrichedMessage => {
      expect(E.isRight(enrichedMessage)).toBe(true);
      if (E.isRight(enrichedMessage)) {
        expect(EnrichedMessage.is(enrichedMessage.right)).toBe(true);
        expect(enrichedMessage.right.category).toEqual({
          tag: TagEnumBase.EU_COVID_CERT
        });
      }
    });
    expect(functionsContextMock.log.error).not.toHaveBeenCalled();
  });

  it("GIVEN a message with a valid legal_data WHEN a message retrieved from cosmos is enriched THEN the message category must be LEGAL_MESSAGE", async () => {
    getContentFromBlobMock.mockImplementationOnce(() =>
      TE.of(O.some(mockedLegalDataContent))
    );
    const enrichMessages = enrichMessagesData(
      functionsContextMock,
      messageModelMock,
      serviceModelMock,
      blobServiceMock
    );

    const enrichedMessagesPromises = enrichMessages(messages);

    const enrichedMessages = await pipe(
      TE.tryCatch(async () => Promise.all(enrichedMessagesPromises), void 0),
      TE.getOrElse(() => {
        throw Error();
      })
    )();

    enrichedMessages.map(enrichedMessage => {
      expect(E.isRight(enrichedMessage)).toBe(true);
      if (E.isRight(enrichedMessage)) {
        expect(EnrichedMessage.is(enrichedMessage.right)).toBe(true);
        expect(enrichedMessage.right.category).toEqual({
          tag: TagEnumBase.LEGAL_MESSAGE
        });
      }
    });
    expect(functionsContextMock.log.error).not.toHaveBeenCalled();
  });

  it("should return right with right PAYMENT category when message content is retrieved", async () => {
    getContentFromBlobMock.mockImplementationOnce(() =>
      TE.of(O.some(mockedPaymentContent))
    );
    const enrichMessages = enrichMessagesData(
      functionsContextMock,
      messageModelMock,
      serviceModelMock,
      blobServiceMock
    );

    const enrichedMessagesPromises = enrichMessages(messages);

    const enrichedMessages = await pipe(
      TE.tryCatch(async () => Promise.all(enrichedMessagesPromises), void 0),
      TE.getOrElse(() => {
        throw Error();
      })
    )();

    enrichedMessages.map(enrichedMessage => {
      expect(E.isRight(enrichedMessage)).toBe(true);
      if (E.isRight(enrichedMessage)) {
        expect(EnrichedMessage.is(enrichedMessage.right)).toBe(true);
        expect(enrichedMessage.right.category).toEqual({
          tag: TagEnumPayment.PAYMENT,
          rptId: "01234567890012345678901234567"
        });
      }
    });
    expect(functionsContextMock.log.error).not.toHaveBeenCalled();
  });

  it("should return left when service model return a cosmos error", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.left(toCosmosErrorResponse("Any error message"))
    );

    const enrichMessages = enrichMessagesData(
      functionsContextMock,
      messageModelMock,
      serviceModelMock,
      blobServiceMock
    );

    const enrichedMessagesPromises = enrichMessages(messages);

    const enrichedMessages = await pipe(
      TE.tryCatch(async () => Promise.all(enrichedMessagesPromises), void 0),
      TE.getOrElse(() => {
        throw Error();
      })
    )();

    enrichedMessages.map(enrichedMessage => {
      expect(E.isLeft(enrichedMessage)).toBe(true);
    });

    expect(functionsContextMock.log.error).toHaveBeenCalledTimes(1);
    expect(functionsContextMock.log.error).toHaveBeenCalledWith(
      `Cannot enrich message "${aRetrievedMessageWithoutContent.id}" | Error: COSMOS_ERROR_RESPONSE, ServiceId=${aRetrievedMessageWithoutContent.senderServiceId}`
    );
  });

  it("should return left when service model return an empty result", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() => TE.right(O.none));

    const enrichMessages = enrichMessagesData(
      functionsContextMock,
      messageModelMock,
      serviceModelMock,
      blobServiceMock
    );

    const enrichedMessagesPromises = enrichMessages(messages);

    const enrichedMessages = await pipe(
      TE.tryCatch(async () => Promise.all(enrichedMessagesPromises), void 0),
      TE.getOrElse(() => {
        throw Error();
      })
    )();

    enrichedMessages.map(enrichedMessage => {
      expect(E.isLeft(enrichedMessage)).toBe(true);
    });

    expect(functionsContextMock.log.error).toHaveBeenCalledTimes(1);
    expect(functionsContextMock.log.error).toHaveBeenCalledWith(
      `Cannot enrich message "${aRetrievedMessageWithoutContent.id}" | Error: EMPTY_SERVICE, ServiceId=${aRetrievedMessageWithoutContent.senderServiceId}`
    );
  });

  it("should return left when message model return an error", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.right(O.some(aRetrievedService))
    );

    getContentFromBlobMock.mockImplementationOnce(() =>
      TE.left(new Error("GENERIC_ERROR"))
    );

    const enrichMessages = enrichMessagesData(
      functionsContextMock,
      messageModelMock,
      serviceModelMock,
      blobServiceMock
    );

    const enrichedMessagesPromises = enrichMessages(messages);

    const enrichedMessages = await pipe(
      TE.tryCatch(async () => Promise.all(enrichedMessagesPromises), void 0),
      TE.getOrElse(() => {
        throw Error();
      })
    )();

    enrichedMessages.map(enrichedMessage => {
      expect(E.isLeft(enrichedMessage)).toBe(true);
    });

    expect(functionsContextMock.log.error).toHaveBeenCalledTimes(1);
    expect(functionsContextMock.log.error).toHaveBeenCalledWith(
      `Cannot enrich message "${aRetrievedMessageWithoutContent.id}" | Error: GENERIC_ERROR`
    );
  });

  it("should return left when both message and service models return errors", async () => {
    findLastVersionByModelIdMock.mockImplementationOnce(() =>
      TE.left(toCosmosErrorResponse("Any error message"))
    );

    getContentFromBlobMock.mockImplementationOnce(() =>
      TE.left(new Error("GENERIC_ERROR"))
    );

    const enrichMessages = enrichMessagesData(
      functionsContextMock,
      messageModelMock,
      serviceModelMock,
      blobServiceMock
    );

    const enrichedMessagesPromises = enrichMessages(messages);

    const enrichedMessages = await pipe(
      TE.tryCatch(async () => Promise.all(enrichedMessagesPromises), void 0),
      TE.getOrElse(() => {
        throw Error();
      })
    )();

    enrichedMessages.map(enrichedMessage => {
      expect(E.isLeft(enrichedMessage)).toBe(true);
    });

    // 2 errors means 2 calls to tracking
    expect(functionsContextMock.log.error).toHaveBeenCalledTimes(2);
    expect(functionsContextMock.log.error).toHaveBeenCalledWith(
      `Cannot enrich message "${aRetrievedMessageWithoutContent.id}" | Error: COSMOS_ERROR_RESPONSE, ServiceId=${aRetrievedMessageWithoutContent.senderServiceId}`
    );
    expect(functionsContextMock.log.error).toHaveBeenCalledWith(
      `Cannot enrich message "${aRetrievedMessageWithoutContent.id}" | Error: GENERIC_ERROR`
    );
  });
});
