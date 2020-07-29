// tslint:disable:no-any

import { NonNegativeInteger } from "italia-ts-commons/lib/numbers";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";

import { response as MockResponse } from "jest-mock-express";

import {
  NewService,
  RetrievedService,
  Service,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "io-functions-commons/dist/src/models/service";
import {
  VISIBLE_SERVICE_BLOB_ID,
  VISIBLE_SERVICE_CONTAINER,
  VisibleService
} from "io-functions-commons/dist/src/models/visible_service";

import { MaxAllowedPaymentAmount } from "io-functions-commons/dist/generated/definitions/MaxAllowedPaymentAmount";

import { GetVisibleServices, GetVisibleServicesHandler } from "../handler";

afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

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
  /*   _self: "123",
  _ts: 123, */
  id: "123" as NonEmptyString,
  kind: "IRetrievedService",
  version: 1 as NonNegativeInteger
};

const aVisibleService: VisibleService = {
  departmentName: aRetrievedService.departmentName,
  id: aRetrievedService.id,
  organizationFiscalCode: aRetrievedService.organizationFiscalCode,
  organizationName: aRetrievedService.organizationName,
  requireSecureChannels: false,
  serviceId: aRetrievedService.serviceId,
  serviceName: aRetrievedService.serviceName,
  version: aRetrievedService.version
};

describe("GetVisibleServicesHandler", () => {
  it("should get all visible services", async () => {
    const blobStorageMock = {
      getBlobToText: jest.fn().mockImplementation((_, __, ___, cb) => {
        cb(
          undefined,
          JSON.stringify({
            serviceId: aVisibleService,
            serviceIdx: aVisibleService
          })
        );
      })
    };
    const getVisibleServicesHandler = GetVisibleServicesHandler(
      blobStorageMock as any
    );
    const response = await getVisibleServicesHandler();
    response.apply(MockResponse());

    await Promise.resolve(); // needed to let the response promise complete
    expect(blobStorageMock.getBlobToText).toHaveBeenCalledWith(
      VISIBLE_SERVICE_CONTAINER,
      VISIBLE_SERVICE_BLOB_ID,
      {},
      expect.any(Function)
    );
    expect(response.kind).toEqual("IResponseSuccessJson");
  });
});

describe("GetVisibleServices", () => {
  it("should set up authentication middleware", async () => {
    GetVisibleServices({} as any);
  });
});
