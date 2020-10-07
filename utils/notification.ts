/**
 * This file contains the CreatedMessageEventSenderMetadata and Notification models.
 */

import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import * as azure from "azure-sb";
import { tryCatch } from "fp-ts/lib/TaskEither";
import { Platform, PlatformEnum } from "../generated/backend/Platform";
import { getConfigOrThrow } from "../utils/config";

/**
 * Notification template.
 *
 * @see https://msdn.microsoft.com/en-us/library/azure/mt621153.aspx
 */
export const INotificationTemplate = t.interface({
  body: t.string
});

export type INotificationTemplate = t.TypeOf<typeof INotificationTemplate>;

/**
 * APNS apns-push-type available values
 *
 * @see https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns
 */
export enum APNSPushType {
  ALERT = "alert",
  BACKGROUND = "background",
  VOIP = "voip",
  COMPLICATION = "complication",
  FILEPROVIDER = "fileprovider",
  MDM = "mdm"
}

const config = getConfigOrThrow();

const notificationHubService = azure.createNotificationHubService(
  config.AZURE_NH_HUB_NAME,
  config.AZURE_NH_ENDPOINT
);

/**
 * A template suitable for Apple's APNs.
 *
 * @see https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CreatingtheNotificationPayload.html
 */
const APNSTemplate: INotificationTemplate = {
  body:
    '{"aps": {"alert": {"title": "$(title)", "body": "$(message)"}}, "message_id": "$(message_id)"}'
};

/**
 * Build a template suitable for Google's GCM.
 *
 * @see https://developers.google.com/cloud-messaging/concept-options
 */
const GCMTemplate: INotificationTemplate = {
  body:
    '{"data": {"title": "$(title)", "message": "$(message)", "message_id": "$(message_id)", "smallIcon": "ic_notification", "largeIcon": "ic_notification"}}'
};

// send the push notification only to the last
// device that set the installationId
// see https://docs.microsoft.com/en-us/azure/notification-hubs/notification-hubs-push-notification-registration-management#installations
export const toNotificationTag = (fiscalCodeHash: NonEmptyString) =>
  `$InstallationId:{${fiscalCodeHash}}`;

const CreateOrUpdateInstallationOptions = t.interface({
  installationId: t.string,
  platform: t.keyof({
    adm: null,
    apns: null,
    gcm: null,
    mpns: null,
    wns: null
  }),
  pushChannel: t.string,
  tags: t.array(t.string),
  templates: t.interface({
    template: INotificationTemplate
  })
});

type CreateOrUpdateInstallationOptions = t.TypeOf<
  typeof CreateOrUpdateInstallationOptions
>;

const NotifyPayload = t.interface({
  message: t.string,
  message_id: t.string,
  title: t.string
});

type NotifyPayload = t.TypeOf<typeof NotifyPayload>;
// NH result
export const NHResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

export type NHResultSuccess = t.TypeOf<typeof NHResultSuccess>;

const successNH = () =>
  NHResultSuccess.encode({
    kind: "SUCCESS"
  });

export const notify = (
  installationId: NonEmptyString,
  payload: NotifyPayload
) => {
  return tryCatch(
    () => {
      return new Promise<NHResultSuccess>((resolve, reject) =>
        notificationHubService.send(
          toNotificationTag(installationId),
          payload,
          {
            // Add required headers for APNS notification to iOS 13
            // https://azure.microsoft.com/en-us/updates/azure-notification-hubs-updates-ios13/
            headers: {
              ["apns-push-type"]: APNSPushType.ALERT,
              ["apns-priority"]: 10
            }
          },
          (error, _) =>
            error == null
              ? resolve(successNH())
              : reject(
                  `Error while sending notification to NotificationHub|${error.message}`
                )
        )
      );
    },
    errs =>
      new Error(`Error while sending notification to NotificationHub|${errs}`)
  );
};

export const createOrUpdateInstallation = (
  installationId: NonEmptyString,
  platform: Platform,
  pushChannel: string,
  tags: ReadonlyArray<string>
) => {
  const azureInstallationOptions: CreateOrUpdateInstallationOptions = {
    // When a single active session per user is allowed, the installation that must be created or updated
    // will have an unique installationId referred to that user.
    // Otherwise the installationId provided by the client will be used.
    installationId,
    platform,
    pushChannel,
    tags: [...tags],
    templates: {
      template: platform === PlatformEnum.apns ? APNSTemplate : GCMTemplate
    }
  };

  return tryCatch(
    () => {
      return new Promise<NHResultSuccess>((resolve, reject) =>
        notificationHubService.createOrUpdateInstallation(
          azureInstallationOptions,
          (err, _) =>
            err == null
              ? resolve(successNH())
              : reject(
                  `Error while creating or updating installation on NotificationHub [
                    ${installationId}] [${err.message}]`
                )
        )
      );
    },
    errs =>
      new Error(
        `Error while creating or updating installation on NotificationHub [${installationId}] [${errs}]`
      )
  );
};

export const deleteInstallation = (installationId: NonEmptyString) => {
  return tryCatch(
    () => {
      return new Promise<NHResultSuccess>((resolve, reject) =>
        notificationHubService.deleteInstallation(installationId, (e, _) =>
          e == null
            ? resolve(successNH())
            : reject(
                `Error while deleting installation on NotificationHub [${installationId}] [${e.message}]`
              )
        )
      );
    },
    errs =>
      new Error(
        `Error while deleting installation on NotificationHub [${installationId}] [${errs}]`
      )
  );
};
