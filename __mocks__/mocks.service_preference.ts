import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import {
  makeServicesPreferencesDocumentId,
  RetrievedServicePreference
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { aCosmosResourceMetadata, aFiscalCode } from "./mocks";

export const aServiceId = "aServiceId" as ServiceId;
export const aServicePreferenceVersion = 2 as NonNegativeInteger;

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
