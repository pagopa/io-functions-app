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
import { enrichMessageData } from "../messages";
import {
  MessageModel,
  NewMessageWithoutContent,
  RetrievedMessageWithoutContent
} from "@pagopa/io-functions-commons/dist/src/models/message";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { TimeToLiveSeconds } from "../../generated/backend/TimeToLiveSeconds";
import { retrievedMessageToPublic } from "@pagopa/io-functions-commons/dist/src/utils/messages";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { EnrichedMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/EnrichedMessage";

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

const messageModelMock = ({
  getContentFromBlob: () =>
    TE.of(
      O.some({
        subject: "a subject",
        markdown: "a markdown"
      } as MessageContent)
    )
} as unknown) as MessageModel;

const serviceModelMock = ({
  findLastVersionByModelId: () => TE.of(O.some(aRetrievedService))
} as unknown) as ServiceModel;

describe("Messages", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should return right when message blob and service are correctly retrieved", async () => {
    const functor = enrichMessageData(
      messageModelMock,
      serviceModelMock,
      blobServiceMock
    );

    const enrichedMessage = await functor(
      retrievedMessageToPublic(aRetrievedMessageWithoutContent)
    );

    expect(E.isRight(enrichedMessage)).toBe(true);
    if (E.isRight(enrichedMessage)) {
      expect(EnrichedMessage.is(enrichedMessage.right)).toBe(true);
    }
  });

  it("should return left when message blob or service are not correctly retrieved", async () => {
    serviceModelMock.findLastVersionByModelId = jest
      .fn()
      .mockImplementationOnce(() => TE.left(E.toError("error")));

    const functor = enrichMessageData(
      messageModelMock,
      serviceModelMock,
      blobServiceMock
    );

    const enrichedMessage = await functor(
      retrievedMessageToPublic(aRetrievedMessageWithoutContent)
    );

    expect(E.isLeft(enrichedMessage)).toBe(true);
  });
});
