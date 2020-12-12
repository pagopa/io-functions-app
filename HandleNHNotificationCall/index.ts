import { Context } from "@azure/functions";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { CreateOrUpdateInstallationMessage } from "../generated/notifications/CreateOrUpdateInstallationMessage";
import { DeleteInstallationMessage } from "../generated/notifications/DeleteInstallationMessage";
import { NotifyMessage } from "../generated/notifications/NotifyMessage";
import { getCallNHServiceActivityHandler } from "../HandleNHNotificationCallActivity/handler";
import { initTelemetryClient } from "../utils/appinsights";

export const NotificationMessage = t.union([
  NotifyMessage,
  CreateOrUpdateInstallationMessage,
  DeleteInstallationMessage
]);

// We duplicate the type here to avoid a mutual dependency;
// that's ok since typescript is structurally typed
export type NotificationHubMessage = t.TypeOf<typeof NotificationMessage>;

export const NhNotificationOrchestratorInput = t.interface({
  message: NotificationMessage
});

export type NhNotificationOrchestratorInput = t.TypeOf<
  typeof NhNotificationOrchestratorInput
>;

// Initialize application insights
initTelemetryClient();

/**
 * Invoke Notification Hub Service call with data provided by an enqued message
 */
export async function index(
  context: Context,
  notificationHubMessage: unknown
): Promise<void> {
  const logPrefix = `HandleNHNotificationCall`;
  // We don't start an orchestrator anymore (to improve performance)
  // but since we must wait for the completion of all durable tasks,
  // we keep it in place at least until the durable task queues are empty.
  // @FIXME: naming
  return NhNotificationOrchestratorInput.decode({
    message: notificationHubMessage
  }).fold(
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
