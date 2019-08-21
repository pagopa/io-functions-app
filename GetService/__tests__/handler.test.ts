// tslint:disable:no-any

import { none, some } from "fp-ts/lib/Option";

import { left, right } from "fp-ts/lib/Either";
import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import {
  NonEmptyString,
  OrganizationFiscalCode
} from "italia-ts-commons/lib/strings";

import {
  NewService,
  RetrievedService,
  Service,
  toAuthorizedCIDRs,
  toAuthorizedRecipients
} from "io-functions-commons/dist/src/models/service";

import { MaxAllowedPaymentAmount } from "io-functions-commons/dist/generated/definitions/MaxAllowedPaymentAmount";
import { ServicePublic } from "io-functions-commons/dist/generated/definitions/ServicePublic";

import { GetServiceHandler } from "../handler";

afterEach(() => {
  jest.resetAllMocks();
  jest.restoreAllMocks();
});

const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;

const aServicePayload: ServicePublic = {
  department_name: "MyDeptName" as NonEmptyString,
  organization_fiscal_code: anOrganizationFiscalCode,
  organization_name: "MyOrgName" as NonEmptyString,
  service_id: "MySubscriptionId" as NonEmptyString,
  service_name: "MyServiceName" as NonEmptyString,
  version: 1
};

const aService: Service = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDeptName" as NonEmptyString,
  isVisible: true,
  maxAllowedPaymentAmount: 0 as MaxAllowedPaymentAmount,
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyOrgName" as NonEmptyString,
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

const aSeralizedService: ServicePublic = {
  ...aServicePayload,
  version: 1 as NonNegativeNumber
};

describe("GetServiceHandler", () => {
  it("should get an existing service", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedService)));
      })
    };
    const aServiceId = "1" as NonEmptyString;
    const getServiceHandler = GetServiceHandler(serviceModelMock as any);
    const response = await getServiceHandler(aServiceId);
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aServiceId
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aSeralizedService);
    }
  });
  it("should fail on errors during get", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(left(none));
      })
    };
    const aServiceId = "1" as NonEmptyString;
    const getServiceHandler = GetServiceHandler(serviceModelMock as any);
    const response = await getServiceHandler(aServiceId);
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aServiceId
    );
    expect(response.kind).toBe("IResponseErrorQuery");
  });
  it("should return not found if the service does not exist", async () => {
    const serviceModelMock = {
      findOneByServiceId: jest.fn(() => {
        return Promise.resolve(right(none));
      })
    };
    const aServiceId = "1" as NonEmptyString;
    const getServiceHandler = GetServiceHandler(serviceModelMock as any);
    const response = await getServiceHandler(aServiceId);
    expect(serviceModelMock.findOneByServiceId).toHaveBeenCalledWith(
      aServiceId
    );
    expect(response.kind).toBe("IResponseErrorNotFound");
  });
});
