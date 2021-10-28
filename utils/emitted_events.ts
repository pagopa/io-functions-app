import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

interface IEvent {
  readonly name: string;
  readonly payload: Record<string, unknown>;
}

export const makeServiceSubscribedEvent = (
  serviceId: ServiceId,
  fiscalCode: FiscalCode
): IEvent => ({
  name: `service:subscribed`,
  payload: { fiscalCode, serviceId }
});

export const makeProfileCompletedEvent = (
  fiscalCode: FiscalCode,
  servicePreferencesMode: ServicesPreferencesModeEnum
): IEvent => ({
  name: `profile:completed`,
  payload: { fiscalCode, servicePreferencesMode }
});

export const makeServicePreferencesChangedEvent = (
  fiscalCode: FiscalCode,
  servicePreferencesMode: ServicesPreferencesModeEnum,
  oldServicePreferencesMode: ServicesPreferencesModeEnum
): IEvent => ({
  name: `profile:service-preferences-changed`,
  payload: {
    fiscalCode,
    oldServicePreferencesMode,
    servicePreferencesMode
  }
});
