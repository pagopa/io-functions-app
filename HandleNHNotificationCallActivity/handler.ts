import * as t from "io-ts";

import { Context } from "@azure/functions";
import { toString } from "fp-ts/lib/function";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { toError } from "fp-ts/lib/Either";
import { fromEither, taskEither } from "fp-ts/lib/TaskEither";
import { KindEnum as CreateOrUpdateKind } from "../generated/notifications/CreateOrUpdateInstallationMessage";
import { KindEnum as DeleteKind } from "../generated/notifications/DeleteInstallationMessage";
import { KindEnum as NotifyKind } from "../generated/notifications/NotifyMessage";
import { NotificationMessage } from "../HandleNHNotificationCall";
import {
  createOrUpdateInstallation,
  deleteInstallation,
  notify
} from "../utils/notification";
import { initTelemetryClient } from "../utils/appinsights";

// Activity input
export const ActivityInput = t.interface({
  message: NotificationMessage
});

export type ActivityInput = t.TypeOf<typeof ActivityInput>;

// Activity result
const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

type ActivityResultFailure = t.TypeOf<typeof ActivityResultFailure>;

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);

export type ActivityResult = t.TypeOf<typeof ActivityResult>;

const failActivity = (context: Context, logPrefix: string) => (
  errorMessage: string,
  errorDetails?: string
) => {
  const details = errorDetails ? `|ERROR_DETAILS=${errorDetails}` : ``;
  context.log.error(`${logPrefix}|${errorMessage}${details}`);
  return ActivityResultFailure.encode({
    kind: "FAILURE",
    reason: errorMessage
  });
};

// trigger a rety in case the notification fail
const retryActivity = (context: Context, msg: string) => {
  context.log.error(msg);
  throw toError(msg);
};

const success = () =>
  ActivityResultSuccess.encode({
    kind: "SUCCESS"
  });

const assertNever = (x: never): never => {
  throw new Error(`Unexpected object: ${toString(x)}`);
};

const telemetryClient = initTelemetryClient();

/**
 * For each Notification Hub Message calls related Notification Hub service
 */
export const getCallNHServiceActivityHandler = (
  logPrefix = "NHCallServiceActivity"
) => async (context: Context, input: unknown) => {
  const failure = failActivity(context, logPrefix);
  return fromEither(ActivityInput.decode(input))
    .mapLeft(errs =>
      failure("Error decoding activity input", readableReport(errs))
    )
    .chain<ActivityResultSuccess>(({ message }) => {
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
            retryActivity(context, `${logPrefix}|ERROR=${toString(e)}`)
          );
        case NotifyKind.Notify:
          return notify(message.installationId, message.payload)
            .mapLeft(e =>
              retryActivity(context, `${logPrefix}|ERROR=${toString(e)}`)
            )
            .chainFirst(
              taskEither.of(
                telemetryClient.trackEvent({
                  name: "api.messages.create.push",
                  properties: {
                    isSuccess: "true",
                    messageId: message.payload.message_id
                  },
                  tagOverrides: { samplingEnabled: "false" }
                })
              )
            );
        case DeleteKind.DeleteInstallation:
          return deleteInstallation(message.installationId).mapLeft(e => {
            // do not trigger a retry as delete may fail in case of 404
            context.log.error(`${logPrefix}|ERROR=${toString(e)}`);
            return failure(e.message);
          });
        default:
          assertNever(message);
      }
    })
    .fold<ActivityResult>(err => err, _ => success())
    .run();
};
