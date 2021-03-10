import * as t from "io-ts";

import { Context } from "@azure/functions";
import { toString } from "fp-ts/lib/function";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { fromEither } from "fp-ts/lib/TaskEither";
import { createOrUpdateInstallation } from "../utils/notification";

import { CreateOrUpdateInstallationMessage } from "../generated/notifications/CreateOrUpdateInstallationMessage";

import {
  ActivityResult,
  ActivityResultSuccess,
  failActivity,
  retryActivity,
  success
} from "../utils/activity";

// Activity input
export const ActivityInput = t.interface({
  message: CreateOrUpdateInstallationMessage
});

export type ActivityInput = t.TypeOf<typeof ActivityInput>;

/**
 * For each Notification Hub Message of type "Delete" calls related Notification Hub service
 */
export const getCallNHCreateOrUpdateInstallationActivityHandler = (
  logPrefix = "NHCreateOrUpdateCallServiceActivityLegacy"
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

      return createOrUpdateInstallation(
        message.installationId,
        message.platform,
        message.pushChannel,
        message.tags
      ).mapLeft(e =>
        retryActivity(context, `${logPrefix}|ERROR=${toString(e)}`)
      );
    })
    .fold<ActivityResult>(err => err, _ => success())
    .run();
};
