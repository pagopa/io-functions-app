// tslint:disable:no-any

import { none, some } from "fp-ts/lib/Option";

import { right } from "fp-ts/lib/Either";
import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import {
  FiscalCode,
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";

import { response as MockResponse } from "jest-mock-express";

import * as middlewares from "io-functions-commons/dist/src/utils/request_middleware";

import {
  NewService,
  RetrievedService,
  Service,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "io-functions-commons/dist/src/models/service";

import { MaxAllowedPaymentAmount } from "io-functions-commons/dist/generated/definitions/MaxAllowedPaymentAmount";

import {
  GetServicesForRecipient,
  GetServicesForRecipientHandler
} from "../handler";

afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;
const aFiscalCode = "SPNDNL80R13D000X" as FiscalCode;

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
  id: "123" as NonEmptyString,
  kind: "INewService",
  version: 1 as NonNegativeNumber
};

const aRetrievedService: RetrievedService = {
  ...aNewService,
  _self: "123",
  _ts: 123,
  kind: "IRetrievedService"
};

const someRetrievedServices: ReadonlyArray<any> = [
  aRetrievedService,
  { ...aRetrievedService, id: "124" }
];

describe("GetServicesByRecipientHandler", () => {
  it("should get id of the services that notified an existing recipient", async () => {
    const mockIterator = {
      executeNext: jest.fn()
    };
    mockIterator.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(some(someRetrievedServices)))
    );
    mockIterator.executeNext.mockImplementationOnce(() =>
      Promise.resolve(right(none))
    );

    const senderServiceModelMock = {
      findSenderServicesForRecipient: jest.fn(() => mockIterator)
    };

    const getSenderServiceHandler = GetServicesForRecipientHandler(
      senderServiceModelMock as any
    );
    const response = await getSenderServiceHandler(aFiscalCode);
    await response.apply(MockResponse());

    expect(
      senderServiceModelMock.findSenderServicesForRecipient
    ).toHaveBeenCalledWith(aFiscalCode);
    expect(response.kind).toBe("IResponseSuccessJsonIterator");
    expect(mockIterator.executeNext).toHaveBeenCalledTimes(2);
  });
});

describe("GetServicesByRecipient", () => {
  // tslint:disable-next-line:no-duplicate-string
  it("should set up authentication middleware", async () => {
    const withRequestMiddlewaresSpy = jest
      .spyOn(middlewares, "withRequestMiddlewares")
      .mockReturnValueOnce(jest.fn());
    GetServicesForRecipient({} as any);
    expect(withRequestMiddlewaresSpy).toHaveBeenCalledTimes(1);
  });
});
