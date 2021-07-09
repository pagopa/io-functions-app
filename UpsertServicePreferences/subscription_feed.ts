import { Context } from "@azure/functions";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { IResponseErrorQuery } from "@pagopa/io-functions-commons/dist/src/utils/response";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { TableService } from "azure-storage";
import { toError } from "fp-ts/lib/Either";
import { taskEither, TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { updateSubscriptionFeed } from "../UpdateSubscriptionsFeedActivity/handler";
import { createTracker } from "../utils/tracking";

export const UpdateSubscriptionFeedInput = t.interface({
  fiscalCode: FiscalCode,
  operation: t.union([t.literal("SUBSCRIBED"), t.literal("UNSUBSCRIBED")]),
  serviceId: ServiceId,
  subscriptionKind: t.literal("SERVICE"),
  updatedAt: t.number,
  version: NonNegativeInteger
});

export type UpdateSubscriptionFeedInput = t.TypeOf<
  typeof UpdateSubscriptionFeedInput
>;

export const updateSubscriptionFeedTask = (
  tableService: TableService,
  subscriptionFeedTable: NonEmptyString,
  context: Context,
  input: UpdateSubscriptionFeedInput,
  logPrefix: string,
  tracker: ReturnType<typeof createTracker>
): TaskEither<IResponseErrorQuery, boolean> =>
  tryCatch(
    () =>
      updateSubscriptionFeed(
        context,
        input,
        tableService,
        subscriptionFeedTable
      ),
    toError
  ).foldTaskEither(
    err => {
      context.log.verbose(
        `${logPrefix}| Error while trying to update subscriptionFeed|ERROR=${err.message}`
      );
      tracker.subscriptionFeed.trackSubscriptionFeedFailure(input, "EXCEPTION");
      return taskEither.of(false);
    },
    result => {
      const isSuccess = result === "SUCCESS";
      if (!isSuccess) {
        context.log.verbose(
          `${logPrefix}| Error while trying to update subscriptionFeed|ERROR=${"FAILURE"}`
        );
        tracker.subscriptionFeed.trackSubscriptionFeedFailure(input, "FAILURE");
      }
      return taskEither.of(isSuccess);
    }
  );
