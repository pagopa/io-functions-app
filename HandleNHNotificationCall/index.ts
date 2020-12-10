import { Context } from "@azure/functions";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { CreateOrUpdateInstallationMessage } from "../generated/notifications/CreateOrUpdateInstallationMessage";
import { DeleteInstallationMessage } from "../generated/notifications/DeleteInstallationMessage";
import { NotifyMessage } from "../generated/notifications/NotifyMessage";
import { getCallNHServiceActivityHandler } from "../HandleNHNotificationCallActivity/handler";
import { NhNotificationOrchestratorInput } from "../HandleNHNotificationCallOrchestrator/handler";
import { initTelemetryClient } from "../utils/appinsights";

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
  input: NotificationHubMessage
): Promise<void> {
  const logPrefix = `NHCallOrchestrator`;
  // We don't start an orchestrator anymore (to improve performance)
  // but since we must wait for the completion of all durable tasks,
  // we keep it in place at least until the durable task queues are empty.
  // @FIXME: naming
  return NhNotificationOrchestratorInput.decode(input).fold(
    err => {
      context.log.error(`${logPrefix}|Error decoding input`);
      context.log.verbose(
        `${logPrefix}|Error decoding input|ERROR=${readableReport(err)}`
      );
    },
    notificationActivityInput =>
      getCallNHServiceActivityHandler()(context, notificationActivityInput)
  );
}
