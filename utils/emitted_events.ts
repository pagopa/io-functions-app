import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
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
