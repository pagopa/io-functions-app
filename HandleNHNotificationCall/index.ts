import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as t from "io-ts";
import { CreateOrUpdateInstallationMessage } from "../generated/notifications/CreateOrUpdateInstallationMessage";
import { DeleteInstallationMessage } from "../generated/notifications/DeleteInstallationMessage";
import { NotifyMessage } from "../generated/notifications/NotifyMessage";
import { initTelemetryClient } from "../utils/appinsights";

export const NotificationMessage = t.taggedUnion("kind", [
  NotifyMessage,
  CreateOrUpdateInstallationMessage,
  DeleteInstallationMessage
]);

export type NotificationHubMessage = t.TypeOf<typeof NotificationMessage>;

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
