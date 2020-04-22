import { Context } from "@azure/functions";
import * as df from "durable-functions";
import * as t from "io-ts";
import { PatternString } from "italia-ts-commons/lib/strings";
import { Platform } from "../generated/backend/Platform";
import { OrchestratorInput as NHCallOrchestratorInput } from "../NHCallOrchestrator/handler";
import { initTelemetryClient } from "../utils/appinsights";

export type FiscalCodeHash = t.TypeOf<typeof FiscalCodeHash>;
export const FiscalCodeHash = PatternString("[0-9a-f]{64}");

export const NotificationHubNotifyMessage = t.interface({
  installationId: FiscalCodeHash,
  kind: t.literal("NotifyKind"),
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
  installationId: FiscalCodeHash,
  kind: t.literal("CreateOrUpdateKind"),
  platform: Platform,
  pushChannel: t.string,
  tags: t.array(t.string)
});
export type NotificationHubCreateOrUpdateMessage = t.TypeOf<
  typeof NotificationHubCreateOrUpdateMessage
>;

export const NotificationHubDeleteMessage = t.interface({
  installationId: FiscalCodeHash,
  kind: t.literal("DeleteKind")
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
  const nhCallOrchestratorInput = NHCallOrchestratorInput.encode({
    message: notificationHubMessage
  });
  await df
    .getClient(context)
    .startNew("NHCallOrchestrator", undefined, nhCallOrchestratorInput);
}
