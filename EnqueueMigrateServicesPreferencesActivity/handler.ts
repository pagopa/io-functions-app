import { Context } from "@azure/functions";
import { QueueServiceClient } from "@azure/storage-queue";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as e from "fp-ts/lib/Either";
import * as te from "fp-ts/lib/TaskEither";
import { MigrateServicesPreferencesQueueMessage } from "../MigrateServicePreferenceFromLegacy/handler";

const LOG_PREFIX = "EnqueueMigrateServicesPreferencesActivity";

type IEnqueueMigrateServicesPreferencesActivityHandler = (
  queueService: QueueServiceClient,
  queueName: NonEmptyString
) => (context: Context, rawInput: unknown) => Promise<string>;

export const getEnqueueMigrateServicesPreferencesActivityHandler: IEnqueueMigrateServicesPreferencesActivityHandler = (
  queueService,
  queueName
) => async (context: Context, rawInput: unknown): Promise<string> =>
  te
    .fromEither(MigrateServicesPreferencesQueueMessage.decode(rawInput))
    .foldTaskEither(
      error => {
        context.log.error(
          `${LOG_PREFIX}|Cannot parse input|ERROR=${readableReport(error)}`
        );
        return te.fromEither(e.right("FAILURE"));
      },
      message =>
        te
          .tryCatch(
            () =>
              queueService
                .getQueueClient(queueName)
                // Default message TTL is 7 days @ref https://docs.microsoft.com/it-it/azure/storage/queues/storage-nodejs-how-to-use-queues?tabs=javascript#queue-service-concepts
                .sendMessage(
                  Buffer.from(JSON.stringify(message)).toString("base64")
                ),
            err => {
              context.log.error(
                `${LOG_PREFIX}|Cannot send a message to the queue ${queueName}|ERROR=${JSON.stringify(
                  err
                )}`
              );
              return e.toError(err);
            }
          )
          .map(() => "SUCCESS")
    )
    .mapLeft(e.toError)
    .getOrElseL(err => {
      throw new Error(`TRANSIENT ERROR|${err.name}|${err.message}`);
    })
    .run();
