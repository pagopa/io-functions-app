import { ServiceScopeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceScope";
import { StandardServiceCategoryEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/StandardServiceCategory";
import { ServiceMetadata } from "@pagopa/io-functions-commons/dist/src/models/service";
import { toAuthorizedRecipients } from "@pagopa/io-functions-commons/dist/src/models/service";
import { NewService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { toAuthorizedCIDRs } from "@pagopa/io-functions-commons/dist/src/models/service";
import { Service } from "@pagopa/io-functions-commons/dist/src/models/service";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { OrganizationFiscalCode } from "@pagopa/ts-commons/lib/strings";

export const aServiceID = "MySubscriptionId" as NonEmptyString;

const anOrganizationFiscalCode = "01234567890" as OrganizationFiscalCode;
const aTokenName = "TOKEN_NAME" as NonEmptyString;
const someServicesMetadata: ServiceMetadata = {
  category: StandardServiceCategoryEnum.STANDARD,
  customSpecialFlow: undefined,
  scope: ServiceScopeEnum.NATIONAL,
  tokenName: aTokenName
};

export const aService: Service = {
  authorizedCIDRs: toAuthorizedCIDRs([]),
  authorizedRecipients: toAuthorizedRecipients([]),
  departmentName: "MyDeptName" as NonEmptyString,
  isVisible: true,
  maxAllowedPaymentAmount: 0 as Service["maxAllowedPaymentAmount"],
  organizationFiscalCode: anOrganizationFiscalCode,
  organizationName: "MyOrgName" as NonEmptyString,
  requireSecureChannels: false,
  serviceId: aServiceID,
  serviceName: "MyServiceName" as NonEmptyString,
  ...someServicesMetadata
};

export const aNewService: NewService = {
  ...aService,
  kind: "INewService"
};

export const serviceList = [aNewService];
