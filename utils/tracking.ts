import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { initTelemetryClient } from "./appinsights";
import { toHash } from "./crypto";

export const createTracker = (
  telemetryClient: ReturnType<typeof initTelemetryClient>
) => {
  const eventName = (name: string) => `api.profile.${name}`;

  /**
   * Trace an event when a user changes their preference mode
   */
  const traceServicePreferenceModeChange = (
    hashedFiscalCode: string,
    previousMode: ServicesPreferencesModeEnum,
    nextMode: ServicesPreferencesModeEnum
  ) =>
    telemetryClient.trackEvent({
      name: eventName("change-service-preferences-mode"),
      properties: {
        nextMode,
        previousMode,
        userId: hashedFiscalCode
      },
      tagOverrides: { samplingEnabled: "false" }
    });

  /**
   * Trace an event when a user has previous preferences to migrate
   */
  const traceMigratingServicePreferences = (
    oldProfile: RetrievedProfile,
    newProfile: RetrievedProfile,
    action: "REQUESTING" | "DOING"
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
        servicePreferencesVersion:
          newProfile.servicePreferencesSettings.version,
        userId: toHash(newProfile.fiscalCode)
      },
      tagOverrides: { samplingEnabled: "false" }
    });

  return {
    profile: {
      traceMigratingServicePreferences,
      traceServicePreferenceModeChange
    }
  };
};
