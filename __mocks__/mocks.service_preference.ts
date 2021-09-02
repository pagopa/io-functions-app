import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { ServicePreference } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicePreference";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import {
  makeServicesPreferencesDocumentId,
  RetrievedServicePreference
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { aCosmosResourceMetadata, aFiscalCode } from "./mocks";

export const aServiceId = "aServiceId" as ServiceId;
export const aServicePreferenceVersion = 0 as NonNegativeInteger;

export const aRetrievedServicePreference: RetrievedServicePreference = {
  ...aCosmosResourceMetadata,
  isEmailEnabled: true,
  isInboxEnabled: true,
  isWebhookEnabled: true,
  settingsVersion: aServicePreferenceVersion,
  fiscalCode: aFiscalCode,
  serviceId: aServiceId,
  kind: "IRetrievedServicePreference",
  id: makeServicesPreferencesDocumentId(
    aFiscalCode,
    aServiceId,
    aServicePreferenceVersion
  )
};

export const aServicePreference: ServicePreference = {
  is_email_enabled: true,
  is_inbox_enabled: true,
  is_webhook_enabled: true,
  settings_version: aServicePreferenceVersion
};

export const aRetrievedService: RetrievedService = ({
  ...aCosmosResourceMetadata,
  serviceId: aServiceId,
  isVisible: true
} as any) as RetrievedService;
