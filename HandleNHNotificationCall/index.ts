import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { Platform } from "../generated/backend/Platform";
import { NotificationHubMessageKindEnum } from "../generated/notifications/NotificationHubMessageKind";
import { initTelemetryClient } from "../utils/appinsights";

export const NotificationHubNotifyInstallationMessage = t.interface({
  installationId: NonEmptyString,
  kind: t.literal(NotificationHubMessageKindEnum.Notify),
  payload: t.interface({
    message: t.string,
    message_id: t.string,
    title: t.string
  })
});
export type NotificationHubNotifyInstallationMessage = t.TypeOf<
  typeof NotificationHubNotifyInstallationMessage
>;
export const NotificationHubCreateOrUpdateInstallationMessage = t.interface({
  installationId: NonEmptyString,
  kind: t.literal(NotificationHubMessageKindEnum.CreateOrUpdateInstallation),
  platform: Platform,
  pushChannel: t.string,
  tags: t.array(t.string)
});
export type NotificationHubCreateOrUpdateInstallationMessage = t.TypeOf<
  typeof NotificationHubCreateOrUpdateInstallationMessage
>;

export const NotificationHubDeleteInstallationMessage = t.interface({
  installationId: NonEmptyString,
  kind: t.literal(NotificationHubMessageKindEnum.DeleteInstallation)
});

export type NotificationHubDeleteInstallationMessage = t.TypeOf<
  typeof NotificationHubDeleteInstallationMessage
>;

export const NotificationHubMessage = t.taggedUnion("kind", [
  NotificationHubNotifyInstallationMessage,
  NotificationHubCreateOrUpdateInstallationMessage,
  NotificationHubDeleteInstallationMessage
]);

export type NotificationHubMessage = t.TypeOf<typeof NotificationHubMessage>;

// Initialize application insights
initTelemetryClient();

/**
 * Invoke Orchestrator to manage Notification Hub Service call with data provided by an enqued message
 */
export async function index(
  context: Context,
  notificationHubMessage: NotificationHubMessage
): Promise<void> {
  await df
    .getClient(context)
    .startNew("HandleNHNotificationCallOrchestrator", undefined, {
      message: notificationHubMessage
    });
}
