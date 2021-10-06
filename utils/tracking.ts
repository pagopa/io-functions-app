import { FiscalCode } from "@pagopa/io-functions-commons/dist/generated/definitions/FiscalCode";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { EventTelemetry } from "applicationinsights/out/Declarations/Contracts";
import { UpdateSubscriptionFeedInput } from "../UpsertServicePreferences/subscription_feed";
import { initTelemetryClient } from "./appinsights";
import { toHash } from "./crypto";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const createTracker = (
  telemetryClient: ReturnType<typeof initTelemetryClient>
) => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const eventName = (name: string) => `api.profile.${name}`;

  /**
   * Trace an event when a user changes their preference mode
   */
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const traceServicePreferenceModeChange = (
    fiscalCode: FiscalCode,
    previousMode: ServicesPreferencesModeEnum,
    nextMode: ServicesPreferencesModeEnum,
    profileVersion: NonNegativeInteger
  ) =>
    telemetryClient.trackEvent({
      name: eventName("change-service-preferences-mode"),
      properties: {
        nextMode,
        previousMode,
        profileVersion,
        userId: toHash(fiscalCode)
      },
      tagOverrides: { samplingEnabled: "false" }
    });

  /**
   * Trace an event when a user has previous preferences to migrate
   */
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const traceMigratingServicePreferences = (
    oldProfile: RetrievedProfile,
    newProfile: RetrievedProfile,
    action: "REQUESTING" | "DOING" | "DONE"
  ) =>
    telemetryClient.trackEvent({
      name: eventName("migrate-legacy-preferences"),
      properties: {
        action,
        oldPreferences: oldProfile.blockedInboxOrChannels,
        oldPreferencesCount: Object.keys(
          oldProfile.blockedInboxOrChannels || {}
        ).length,
        profileVersion: newProfile.version,
        servicePreferencesMode: newProfile.servicePreferencesSettings.mode,
        servicePreferencesVersion:
          newProfile.servicePreferencesSettings.version,
        userId: toHash(newProfile.fiscalCode)
      },
      tagOverrides: { samplingEnabled: "false" }
    });

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const trackSubscriptionFeedFailure = (
    { fiscalCode, version, updatedAt, ...input }: UpdateSubscriptionFeedInput,
    kind: "EXCEPTION" | "FAILURE"
  ) => {
    telemetryClient.trackEvent({
      name: "subscriptionFeed.upsertServicesPreferences.failure",
      properties: {
        ...input,
        fiscalCode: toHash(fiscalCode),
        kind,
        updatedAt: updatedAt.toString(),
        version: version.toString()
      },
      tagOverrides: { samplingEnabled: "false" }
    } as EventTelemetry);
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/ban-types
  const traceEmailValidationSend = (messageInfo: object) => {
    telemetryClient.trackEvent({
      name: `SendValidationEmailActivity.success`,
      properties: messageInfo
    } as EventTelemetry);
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const trackServiceEnrichmentFailure = (
    fiscalCode: FiscalCode,
    messageId: string,
    serviceId: ServiceId,
  ) => {
    telemetryClient.trackEvent({
      name: "messages.enrichMessages.failure",
      properties: {
        fiscalCode: toHash(fiscalCode),
        messageId,
        serviceId
      },
      tagOverrides: { samplingEnabled: "false" }
    } as EventTelemetry);
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const trackContentEnrichmentFailure = (
    fiscalCode: FiscalCode,
    messageId: string
  ) => {
    telemetryClient.trackEvent({
      name: "messages.enrichMessages.failure",
      properties: {
        fiscalCode: toHash(fiscalCode),
        messageId
      },
      tagOverrides: { samplingEnabled: "false" }
    } as EventTelemetry);
  };

  return {
    profile: {
      traceEmailValidationSend,
      traceMigratingServicePreferences,
      traceServicePreferenceModeChange
    },
    subscriptionFeed: {
      trackSubscriptionFeedFailure
    },
    messages: {
      trackServiceEnrichmentFailure,
      trackContentEnrichmentFailure
    }
  };
};
