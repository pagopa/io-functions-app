import { flow, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";

import { ServicePreference } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicePreference";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { Profile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  AccessReadMessageStatus,
  AccessReadMessageStatusEnum,
  RetrievedServicePreference
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { FiscalCode } from "@pagopa/io-functions-commons/dist/generated/definitions/FiscalCode";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "@pagopa/io-functions-commons/dist/src/utils/response";
import { ActivationModel } from "@pagopa/io-functions-commons/dist/src/models/activation";
import { ActivationStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ActivationStatus";
import { UpsertServicePreference } from "../generated/definitions/internal/UpsertServicePreference";

const toUserServicePreference = (
  accessReadMessageStatus: AccessReadMessageStatus,
  emailEnabled: boolean,
  inboxEnabled: boolean,
  webhookEnabled: boolean,
  version: NonNegativeInteger
): ServicePreference => ({
  can_access_message_read_status:
    accessReadMessageStatus !== AccessReadMessageStatusEnum.DENY,
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
    servicePref.accessReadMessageStatus,
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
): ServicePreference =>
  toUserServicePreference(
    AccessReadMessageStatusEnum.UNKNOWN,
    true,
    true,
    true,
    version
  );

/**
 * Create a default DISABLED ServicePreference
 *
 * @param version the service preference version
 * @returns
 */
export const toDefaultDisabledUserServicePreference = (
  version: NonNegativeInteger
): ServicePreference =>
  toUserServicePreference(
    AccessReadMessageStatusEnum.DENY,
    false,
    false,
    false,
    version
  );

/**
 *
 * @param profile
 * @returns
 */
// eslint-disable-next-line arrow-body-style
export const nonLegacyServicePreferences = (profile: Profile): boolean => {
  return (
    profile.servicePreferencesSettings.mode ===
      ServicesPreferencesModeEnum.AUTO ||
    profile.servicePreferencesSettings.mode ===
      ServicesPreferencesModeEnum.MANUAL
  );
};

/**
 * Get Service Preference Setting Version for giver profile,
 * or fail if is negative
 *
 * @param profile
 * @returns
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function getServicePreferenceSettingsVersion(
  profile: Profile
): TE.TaskEither<Error, NonNegativeInteger> {
  return pipe(
    profile.servicePreferencesSettings.version,
    NonNegativeInteger.decode,
    TE.fromEither,
    TE.mapLeft(_ => Error("Service Preferences Version < 0 not allowed"))
  );
}

export type ServicePreferencesForSpecialServices = <
  T extends UpsertServicePreference | ServicePreference
>(params: {
  readonly serviceId: ServiceId;
  readonly fiscalCode: FiscalCode;
  readonly servicePreferences: T;
}) => TE.TaskEither<IResponseErrorQuery, T>;

export const getServicePreferencesForSpecialServices = (
  activationModel: ActivationModel
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
): ServicePreferencesForSpecialServices => ({
  serviceId,
  fiscalCode,
  servicePreferences
}) =>
  pipe(
    activationModel.findLastVersionByModelId([serviceId, fiscalCode]),
    TE.mapLeft(err =>
      ResponseErrorQuery("Error reading service Activation", err)
    ),
    TE.map(
      flow(
        O.filter(
          activation => activation.status === ActivationStatusEnum.ACTIVE
        ),
        O.foldW(
          () => ({
            ...servicePreferences,
            is_inbox_enabled: false
          }),
          _ => ({
            ...servicePreferences,
            is_inbox_enabled: true
          })
        )
      )
    )
  );
