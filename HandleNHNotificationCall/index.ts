import { Context } from "@azure/functions";
import * as df from "durable-functions";
import { taskEither } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { ActivityResult } from "../CreateValidationTokenActivity/handler";
import { CreateOrUpdateInstallationMessage } from "../generated/notifications/CreateOrUpdateInstallationMessage";
import { DeleteInstallationMessage } from "../generated/notifications/DeleteInstallationMessage";
import { NotifyMessage } from "../generated/notifications/NotifyMessage";
import { initTelemetryClient } from "../utils/appinsights";
import { createOrUpdateInstallation, notify, deleteInstallation } from "../utils/notification";
import { KindEnum as CreateOrUpdateKind } from "../generated/notifications/CreateOrUpdateInstallationMessage";
import { KindEnum as DeleteKind } from "../generated/notifications/DeleteInstallationMessage";
import { KindEnum as NotifyKind } from "../generated/notifications/NotifyMessage";
import { toError } from "fp-ts/lib/Either";

export const NotificationMessage = t.union([
  NotifyMessage,
  CreateOrUpdateInstallationMessage,
  DeleteInstallationMessage
]);

export type NotificationHubMessage = t.TypeOf<typeof NotificationMessage>;

const logPrefix = "HandleNHNotifcationCall"

const TriggerResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

type TriggerResultSuccess = t.TypeOf<typeof TriggerResultSuccess>;

const TriggerResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

type TriggerResultFailure = t.TypeOf<typeof TriggerResultFailure>;

export const TriggerResult = t.taggedUnion("kind", [
  TriggerResultSuccess,
  TriggerResultFailure
]);

export type TriggerResult = t.TypeOf<typeof TriggerResult>;

// Initialize application insights
initTelemetryClient();

const fail = (context: Context, logPrefix: string) => (
  errorMessage: string,
  errorDetails?: string
) => {
  const details = errorDetails ? `|ERROR_DETAILS=${errorDetails}` : ``;
  context.log.error(`${logPrefix}|${errorMessage}${details}`);
};

// trigger a retry in case the notification fail
const retry = (context: Context, msg: string) => {
  context.log.error(msg);
  throw toError(msg);
};

const assertNever = (x: never): never => {
  throw new Error(`Unexpected object: ${String(x)}`);
};

/**
 * Invoke Orchestrator to manage Notification Hub Service call with data provided by an enqued message
 */
export async function index(
  context: Context,
  notificationHubMessage: NotificationHubMessage
): Promise<TriggerResult> {
  const failure = fail(context, logPrefix);
  return taskEither.of(notificationHubMessage)
    .chain(message  => {
      context.log.info(
        `${logPrefix}|${message.kind}|INSTALLATION_ID=${message.installationId}`
      );
      switch (message.kind) {
        case CreateOrUpdateKind.CreateOrUpdateInstallation:
          return createOrUpdateInstallation(
            message.installationId,
            message.platform,
            message.pushChannel,
            message.tags
          ).mapLeft(e =>
            retry(context, `${logPrefix}|ERROR=${e.message}`)
          );
        case NotifyKind.Notify:
          return notify(message.installationId, message.payload).mapLeft(e =>
            retry(context, `${logPrefix}|ERROR=${e.message}`)
          );
        case DeleteKind.DeleteInstallation:
          return deleteInstallation(message.installationId).mapLeft(e => {
            // do not trigger a retry as delete may fail in case of 404
            context.log.error(`${logPrefix}|ERROR=${e.message}`);
            return failure(e.message);
          });
        default:
          assertNever(message);
      }
    })
    .fold<TriggerResult>(err => TriggerResultFailure.encode({kind: "FAILURE", reason:(String(err))}), _ => TriggerResultSuccess.encode({
      kind: "SUCCESS"
    }))
    .run();
}
