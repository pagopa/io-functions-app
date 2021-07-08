import { Context } from "@azure/functions";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { IResponseErrorQuery } from "@pagopa/io-functions-commons/dist/src/utils/response";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { TelemetryClient } from "applicationinsights";
import { EventTelemetry } from "applicationinsights/out/Declarations/Contracts";
import { TableService } from "azure-storage";
import { toError } from "fp-ts/lib/Either";
import { taskEither, TaskEither, tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { updateSubscriptionFeed } from "../UpdateSubscriptionsFeedActivity/handler";

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

export const trackSubscriptionFeedFailure = (
  context: Context,
  aiClient: TelemetryClient,
  input: UpdateSubscriptionFeedInput,
  kind: "EXCEPTION" | "FAILURE",
  logPrefix: string,
  message: string
) => {
  context.log.verbose(
    `${logPrefix}| Error while trying to update subscriptionFeed|ERROR=${message}`
  );
  aiClient.trackEvent({
    name: "subscriptionFeed.upsertServicesPreferences.failure",
    properties: {
      ...input,
      kind,
      updatedAt: input.updatedAt.toString(),
      version: input.version.toString()
    },
    tagOverrides: { samplingEnabled: "false" }
  } as EventTelemetry);
};

export const updateSubscriptionFeedTask = (
  tableService: TableService,
  subscriptionFeedTable: NonEmptyString,
  aiClient: TelemetryClient,
  context: Context,
  input: UpdateSubscriptionFeedInput,
  logPrefix: string
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
      trackSubscriptionFeedFailure(
        context,
        aiClient,
        input,
        "EXCEPTION",
        logPrefix,
        err.message
      );
      return taskEither.of(false);
    },
    result => {
      const isSuccess = result === "SUCCESS";
      if (!isSuccess) {
        trackSubscriptionFeedFailure(
          context,
          aiClient,
          input,
          "FAILURE",
          logPrefix,
          "FAILURE"
        );
      }
      return taskEither.of(isSuccess);
    }
  );
