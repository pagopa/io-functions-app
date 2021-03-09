import { Context } from "@azure/functions";
import * as df from "durable-functions";
import { toString } from "fp-ts/lib/function";
import * as t from "io-ts";

import { orchestratorName as CreateOrUpdateOrchestratorName } from "../HandleNHCreateOrUpdateInstallationCallOrchestratorLegacy/index";
import { orchestratorName as DeleteInstallationOrchestratorName } from "../HandleNHDeleteInstallationCallOrchestratorLegacy/index";
import { orchestratorName as NotifyMessageOrchestratorName } from "../HandleNHNotifyMessageCallOrchestratorLegacy/index";

import { CreateOrUpdateInstallationMessage } from "../generated/notifications/CreateOrUpdateInstallationMessage";
import { DeleteInstallationMessage } from "../generated/notifications/DeleteInstallationMessage";
import { NotifyMessage } from "../generated/notifications/NotifyMessage";
import { initTelemetryClient } from "../utils/appinsights";

import { KindEnum as CreateOrUpdateKind } from "../generated/notifications/CreateOrUpdateInstallationMessage";
import { KindEnum as DeleteKind } from "../generated/notifications/DeleteInstallationMessage";
import { KindEnum as NotifyKind } from "../generated/notifications/NotifyMessage";

const assertNever = (x: never): never => {
  throw new Error(`Unexpected object: ${toString(x)}`);
};

export const NotificationMessage = t.union([
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
  switch (notificationHubMessage.kind) {
    case DeleteKind.DeleteInstallation:
      const client = df.getClient(context);

      await client.startNew(DeleteInstallationOrchestratorName, undefined, {
        message: notificationHubMessage
      });
      break;
    case CreateOrUpdateKind.CreateOrUpdateInstallation:
      await df
        .getClient(context)
        .startNew(CreateOrUpdateOrchestratorName, undefined, {
          message: notificationHubMessage
        });
      break;
    case NotifyKind.Notify:
      await df
        .getClient(context)
        .startNew(NotifyMessageOrchestratorName, undefined, {
          message: notificationHubMessage
        });
      break;
    default:
      assertNever(notificationHubMessage);
      break;
  }
}

export default index;
