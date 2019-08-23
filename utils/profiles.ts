import { RetrievedProfile } from "io-functions-commons/dist/src/models/profile";

import { ExtendedProfile } from "io-functions-commons/dist/generated/definitions/ExtendedProfile";

export function toExtendedProfile(profile: RetrievedProfile): ExtendedProfile {
  return {
    accepted_tos_version: profile.acceptedTosVersion,
    blocked_inbox_or_channels: profile.blockedInboxOrChannels,
    email: profile.email,
    is_inbox_enabled: profile.isInboxEnabled === true,
    is_webhook_enabled: profile.isWebhookEnabled === true,
    preferred_languages: profile.preferredLanguages,
    version: profile.version
  };
}
