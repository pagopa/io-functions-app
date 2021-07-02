import { ServicePreference } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicePreference";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { Profile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { NonNegativeInteger } from "@pagopa/io-functions-commons/node_modules/@pagopa/ts-commons/lib/numbers";

const toUserServicePreference = (
  emailEnabled: boolean,
  inboxEnabled: boolean,
  webhookEnabled: boolean,
  version: NonNegativeInteger
): ServicePreference => ({
  is_email_enabled: emailEnabled,
  is_inbox_enabled: inboxEnabled,
  is_webhook_enabled: webhookEnabled,
  settings_version: version
});

/**
 * Map RetrievedServicePreference to ServicePreference
 *
 * @param servicePref
 * @returns
 */
export const toUserServicePreferenceFromModel = (
  servicePref: RetrievedServicePreference
): ServicePreference =>
  toUserServicePreference(
    servicePref.isEmailEnabled,
    servicePref.isInboxEnabled,
    servicePref.isWebhookEnabled,
    servicePref.settingsVersion
  );

/**
 * Create a default ENABLED ServicePreference
 *
 * @param version the service preference version
 * @returns
 */
export const toDefaultEnabledUserServicePreference = (
  version: NonNegativeInteger
): ServicePreference => toUserServicePreference(true, true, true, version);

/**
 * Create a default DISABLED ServicePreference
 *
 * @param version the service preference version
 * @returns
 */
export const toDefaultDisabledUserServicePreference = (
  version: NonNegativeInteger
): ServicePreference => toUserServicePreference(false, false, false, version);

export const nonLegacyServicePreferences = (profile: Profile): boolean => {
  return (
    profile.servicePreferencesSettings.mode ===
      ServicesPreferencesModeEnum.AUTO ||
    profile.servicePreferencesSettings.mode ===
      ServicesPreferencesModeEnum.MANUAL
  );
};