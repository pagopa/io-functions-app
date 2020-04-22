import * as t from "io-ts";

import { Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { isLeft } from "fp-ts/lib/Either";
import {
  NotificationHubCreateOrUpdateMessage,
  NotificationHubDeleteMessage,
  NotificationHubMessage,
  NotificationHubNotifyMessage
} from "../HandleNHNotificationCall";
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
    failure(
      "Error decoding activity input",
      readableReport(errorOrMessage.value)
    );
  }
  const message = errorOrMessage.value;
  if (NotificationHubCreateOrUpdateMessage.is(message)) {
    return createOrUpdateInstallation(
      message.installationId,
      message.platform,
      message.pushChannel,
      message.tags
    ).run();
  }
  if (NotificationHubNotifyMessage.is(message)) {
    return notify(message.installationId, message.payload).run();
  }
  if (NotificationHubDeleteMessage.is(message)) {
    return deleteInstallation(message.installationId).run();
  }
};
