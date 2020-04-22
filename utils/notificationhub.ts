import * as azure from "azure-sb";
import { tryCatch } from "fp-ts/lib/TaskEither";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import * as t from "io-ts";
import { Platform, PlatformEnum } from "../generated/backend/Platform";
import { FiscalCodeHash } from "../NHCallService";
import { APNSPushType, INotificationTemplate } from "./notification";

const hubName = getRequiredStringEnv("AZURE_NH_HUB_NAME");
const endpointOrConnectionString = getRequiredStringEnv("AZURE_NH_ENDPOINT");

const notificationHubService = azure.createNotificationHubService(
  hubName,
  endpointOrConnectionString
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
export const toNotificationTag = (fiscalCodeHash: FiscalCodeHash) =>
  `$InstallationId:{${fiscalCodeHash}}`;

const CreateOrUpdateInstallationOptions = t.interface({
  installationId: t.string,
  platform: t.string,
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
const NHResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

type NHResultSuccess = t.TypeOf<typeof NHResultSuccess>;

const successNH = () =>
  NHResultSuccess.encode({
    kind: "SUCCESS"
  });

export const notify = (
  installationId: FiscalCodeHash,
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
                  `Error while sending notification to NotificationHub| ${error.message}`
                )
        )
      );
    },
    errs =>
      new Error(`Error while sending notification to NotificationHub| ${errs}`)
  );
};

export const createOrUpdateInstallation = (
  installationId: FiscalCodeHash,
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
          installationId,
          azureInstallationOptions,
          (err, _) =>
            err == null
              ? resolve(successNH())
              : reject(
                  `Error while creating or updating installation on NotificationHub [${JSON.stringify(
                    installationId
                  )}] [${err.message}]`
                )
        )
      );
    },
    errs =>
      new Error(
        `Error while creating or updating installation on NotificationHub [${JSON.stringify(
          installationId
        )}] [${errs}]`
      )
  );
};

export const deleteInstallation = (installationId: FiscalCodeHash) => {
  return tryCatch(
    () => {
      return new Promise<NHResultSuccess>((resolve, reject) =>
        notificationHubService.deleteInstallation(installationId, (e, _) =>
          e == null
            ? resolve(successNH())
            : reject(
                `Error while deleting installation on NotificationHub [${JSON.stringify(
                  installationId
                )}] [${e.message}]`
              )
        )
      );
    },
    errs =>
      new Error(
        `Error while deleting installation on NotificationHub [${JSON.stringify(
          installationId
        )}] [${errs}]`
      )
  );
};
