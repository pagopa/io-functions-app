import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as t from "io-ts";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { Platform } from "../generated/backend/Platform";
import { initTelemetryClient } from "../utils/appinsights";

export const NotificationHubNotifyMessage = t.interface({
  installationId: NonEmptyString,
  kind: t.literal("Notify"),
  payload: t.interface({
    message: t.string,
    message_id: t.string,
    title: t.string
  })
});
export type NotificationHubNotifyMessage = t.TypeOf<
  typeof NotificationHubNotifyMessage
>;
export const NotificationHubCreateOrUpdateMessage = t.interface({
  installationId: NonEmptyString,
  kind: t.literal("CreateOrUpdate"),
  platform: Platform,
  pushChannel: t.string,
  tags: t.array(t.string)
});
export type NotificationHubCreateOrUpdateMessage = t.TypeOf<
  typeof NotificationHubCreateOrUpdateMessage
>;

export const NotificationHubDeleteMessage = t.interface({
  installationId: NonEmptyString,
  kind: t.literal("Delete")
});

export type NotificationHubDeleteMessage = t.TypeOf<
  typeof NotificationHubDeleteMessage
>;

export const NotificationHubMessage = t.taggedUnion("kind", [
  NotificationHubNotifyMessage,
  NotificationHubCreateOrUpdateMessage,
  NotificationHubDeleteMessage
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
