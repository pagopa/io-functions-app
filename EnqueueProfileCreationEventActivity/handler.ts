import { Context } from "@azure/functions";
import { QueueServiceClient } from "@azure/storage-queue";
import { tryCatch } from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "italia-ts-commons/lib/strings";

export const EnqueueProfileCreationEventActivityInput = t.interface({
  fiscalCode: FiscalCode,
  queueName: NonEmptyString
});
export type EnqueueProfileCreationEventActivityInput = t.TypeOf<
  typeof EnqueueProfileCreationEventActivityInput
>;

type IEnqueueProfileCreationEventActivityHandler = (
  queueService: QueueServiceClient
) => (context: Context, rawInput: unknown) => Promise<string>;

export const GetEnqueueProfileCreationEventActivityHandler: IEnqueueProfileCreationEventActivityHandler = (
  queueService: QueueServiceClient
) => async (context: Context, rawInput: unknown): Promise<string> => {
  const decodedInputOrError = EnqueueProfileCreationEventActivityInput.decode(
    rawInput
  );
  if (decodedInputOrError.isLeft()) {
    context.log.error(
      `EnqueueProfileCreationEventActivity|Cannot parse input|ERROR=${readableReport(
        decodedInputOrError.value
      )}`
    );
    return "FAILURE";
  }
  return tryCatch(
    () =>
      queueService
        .getQueueClient(decodedInputOrError.value.queueName)
        // Default message TTL is 7 days @ref https://docs.microsoft.com/it-it/azure/storage/queues/storage-nodejs-how-to-use-queues?tabs=javascript#queue-service-concepts
        .sendMessage(decodedInputOrError.value.fiscalCode),
    err => {
      context.log.error(
        `EnqueueProfileCreationEventActivity|Cannot send a message to the queue ${
          decodedInputOrError.value.queueName
        }|ERROR=${JSON.stringify(err)}`
      );
    }
  )
    .map(() => "SUCCESS")
    .getOrElseL(err => {
      throw new Error(`TRANSIENT ERROR|${err}`);
    })
    .run();
};
