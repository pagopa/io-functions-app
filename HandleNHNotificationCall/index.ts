import { Context } from "@azure/functions";
import * as df from "durable-functions";
import { toString } from "fp-ts/lib/function";
import * as t from "io-ts";
import { initTelemetryClient } from "../utils/appinsights";

import { CreateOrUpdateInstallationMessage } from "../generated/notifications/CreateOrUpdateInstallationMessage";
import { DeleteInstallationMessage } from "../generated/notifications/DeleteInstallationMessage";
import { NotifyMessage } from "../generated/notifications/NotifyMessage";

import { KindEnum as CreateOrUpdateKind } from "../generated/notifications/CreateOrUpdateInstallationMessage";
import { KindEnum as DeleteKind } from "../generated/notifications/DeleteInstallationMessage";
import { KindEnum as NotifyKind } from "../generated/notifications/NotifyMessage";

export const NotificationMessage = t.union([
  NotifyMessage,
  CreateOrUpdateInstallationMessage,
  DeleteInstallationMessage
]);

export type NotificationHubMessage = t.TypeOf<typeof NotificationMessage>;

const assertNever = (x: never): never => {
  throw new Error(`Unexpected object: ${toString(x)}`);
};

// Initialize application insights
initTelemetryClient();

/**
 * Invoke Orchestrator to manage Notification Hub Service call with data provided by an enqued message
 */
export async function index(
  context: Context,
  notificationHubMessage: NotificationHubMessage
): Promise<void> {
  const client = df.getClient(context);
  switch (notificationHubMessage.kind) {
    case DeleteKind.DeleteInstallation:
    case CreateOrUpdateKind.CreateOrUpdateInstallation:
    case NotifyKind.Notify:
      await client.startNew("HandleNHNotificationCallOrchestrator", undefined, {
        message: notificationHubMessage
      });
      break;
    default:
      assertNever(notificationHubMessage);
      break;
  }
}

export default index;
