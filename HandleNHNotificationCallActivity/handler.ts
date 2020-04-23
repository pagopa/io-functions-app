import * as t from "io-ts";

import { Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { isLeft } from "fp-ts/lib/Either";
import { NotificationHubMessage } from "../HandleNHNotificationCall";
import {
  createOrUpdateInstallation,
  deleteInstallation,
  notify
} from "../utils/notification";

// Activity input
export const ActivityInput = t.interface({
  message: NotificationHubMessage
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

/**
 * For each Notification Hub Message calls related Notification Hub service
 */
export const getCallNHServiceActivityHandler = (
  logPrefix = "NHCallServiceActivity"
) => async (context: Context, input: unknown) => {
  const failure = failActivity(context, logPrefix);
  const errorOrMessage = ActivityInput.decode(input);
  if (isLeft(errorOrMessage)) {
    return failure(
      "Error decoding activity input",
      readableReport(errorOrMessage.value)
    );
  }
  const message = errorOrMessage.value.message;
  switch (message.kind) {
    case "CreateOrUpdateInstallation":
      return createOrUpdateInstallation(
        message.installationId,
        message.platform,
        message.pushChannel,
        message.tags
      ).run();
    case "NotifyInstallation":
      return notify(message.installationId, message.payload).run();
    case "DeleteInstallation":
      return deleteInstallation(message.installationId).run();
  }
};
