import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import {
  Profile,
  RetrievedProfile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
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
        userId: hashedFiscalCode,
        previousMode,
        nextMode
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
        userId: toHash(newProfile.fiscalCode),
        action,
        profileVersion: newProfile.version,
        servicePreferencesVersion:
          newProfile.servicePreferencesSettings.version,
        oldPreferences: oldProfile.blockedInboxOrChannels,
        oldPreferencesCount: Object.keys(
          oldProfile.blockedInboxOrChannels || {}
        ).length
      },
      tagOverrides: { samplingEnabled: "false" }
    });

  return {
    profile: {
      traceServicePreferenceModeChange,
      traceMigratingServicePreferences
    }
  };
};
