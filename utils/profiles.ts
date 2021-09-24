import { isObject } from "util";
import { ITuple2, Tuple2 } from "@pagopa/ts-commons/lib/tuples";

import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";
import { ExtendedProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/ExtendedProfile";
import { IsEmailValidated } from "@pagopa/io-functions-commons/dist/generated/definitions/IsEmailValidated";
import { Profile as ApiProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/Profile";
import {
  Profile,
  PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION,
  RetrievedProfile
} from "@pagopa/io-functions-commons/dist/src/models/profile";

import { FiscalCode } from "@pagopa/io-functions-commons/dist/generated/definitions/FiscalCode";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

/**
 * Converts a ApiProfile in a Profile model
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function apiProfileToProfile(
  apiProfile: ApiProfile,
  fiscalCode: FiscalCode,
  isEmailValidated: IsEmailValidated,
  servicePreferencesSettingsVersion: number
): Profile {
  return {
    acceptedTosVersion: apiProfile.accepted_tos_version,
    blockedInboxOrChannels: apiProfile.blocked_inbox_or_channels,
    email: apiProfile.email,
    fiscalCode,
    isEmailEnabled: apiProfile.is_email_enabled,
    isEmailValidated,
    isInboxEnabled: apiProfile.is_inbox_enabled,
    isWebhookEnabled: apiProfile.is_webhook_enabled,
    preferredLanguages: apiProfile.preferred_languages,
    servicePreferencesSettings:
      apiProfile.service_preferences_settings === undefined ||
      apiProfile.service_preferences_settings.mode ===
        ServicesPreferencesModeEnum.LEGACY
        ? {
            mode: ServicesPreferencesModeEnum.LEGACY,
            version: PROFILE_SERVICE_PREFERENCES_SETTINGS_LEGACY_VERSION
          }
        : {
            mode: apiProfile.service_preferences_settings.mode,
            version: servicePreferencesSettingsVersion as NonNegativeInteger
          }
  };
}

/**
 * Converts a RetrievedProfile model to an ExtendedProfile
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function retrievedProfileToExtendedProfile(
  profile: RetrievedProfile
): ExtendedProfile {
  return {
    accepted_tos_version: profile.acceptedTosVersion,
    blocked_inbox_or_channels: profile.blockedInboxOrChannels,
    email: profile.email,
    is_email_enabled: profile.isEmailEnabled !== false,
    is_email_validated: profile.isEmailValidated !== false,
    is_inbox_enabled: profile.isInboxEnabled === true,
    is_test_profile: profile.isTestProfile === true,
    is_webhook_enabled: profile.isWebhookEnabled === true,
    preferred_languages: profile.preferredLanguages,
    service_preferences_settings: profile.servicePreferencesSettings,
    version: profile.version
  };
}

/**
 * Extracts the services that have inbox blocked
 */
const getInboxBlockedServices = (
  blocked: Profile["blockedInboxOrChannels"] | undefined | null
): ReadonlyArray<string> =>
  Object.keys(blocked)
    .map(k =>
      blocked[k].includes(BlockedInboxOrChannelEnum.INBOX) ? k : undefined
    )
    .filter(k => k !== undefined);

/**
 * Returns the services that exist in newServices but not in oldServices
 */
const addedServices = (
  oldServices: ReadonlyArray<string>,
  newServices: ReadonlyArray<string>
): ReadonlyArray<string> => newServices.filter(k => oldServices.indexOf(k) < 0);

/**
 * Returns the services that exist in oldServices but not in newServices
 */
const removedServices = (
  oldServices: ReadonlyArray<string>,
  newServices: ReadonlyArray<string>
): ReadonlyArray<string> => oldServices.filter(k => newServices.indexOf(k) < 0);

/**
 * Returns a tuple with the services that have been blocked (1st element) and
 * that have been unblocked (2nd element) by this profile update
 */
export const diffBlockedServices = (
  oldBlocked: Profile["blockedInboxOrChannels"] | undefined | null,
  newBlocked: Profile["blockedInboxOrChannels"] | undefined | null
): ITuple2<ReadonlyArray<string>, ReadonlyArray<string>> => {
  // we extract the services that have the inbox blocked from the old and the
  // eslint-disable-next-line extra-rules/no-commented-out-code
  // new profile
  const oldInboxBlocked = isObject(oldBlocked)
    ? getInboxBlockedServices(oldBlocked)
    : [];
  const newInboxBlocked = isObject(newBlocked)
    ? getInboxBlockedServices(newBlocked)
    : [];

  // we take all the services that have inbox blocked in the new profile but
  // not in the old profile
  const addedBlockedServices = addedServices(oldInboxBlocked, newInboxBlocked);

  // we take all the services that have inbox blocked in the old profile but
  // not in the new profile
  const removedBlockedServices = removedServices(
    oldInboxBlocked,
    newInboxBlocked
  );

  return Tuple2(addedBlockedServices, removedBlockedServices);
};
