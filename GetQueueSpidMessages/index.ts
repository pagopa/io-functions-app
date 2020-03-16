import { Context } from "@azure/functions";
import { createBlobService } from "azure-storage";
import * as azureStorage from "azure-storage";
import { Either } from "fp-ts/lib/Either";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { AzureContextTransport } from "io-functions-commons/dist/src/utils/logging";
import * as t from "io-ts";
import * as winston from "winston";
import { appendSpidBlob } from "../utils/spid_blob_storage";

const AZURE_STORAGE_CONNECTION_STRING = getRequiredStringEnv(
  "AzureWebJobsStorage"
);

const SPID_BLOB_CONTAINER_NAME = getRequiredStringEnv(
  "SPID_BLOB_CONTAINER_NAME"
);

const blobService = createBlobService(AZURE_STORAGE_CONNECTION_STRING);

const SpidMsgItem = t.interface({
  ip: t.string,
  payload: t.string,
  timestamp: t.string
});

type SpidMsgItem = t.TypeOf<typeof SpidMsgItem>;
/**
 * Handler that gets triggered on incoming event.
 */
export function index(
  context: Context,
  spidMsgItem: SpidMsgItem
): Promise<Either<Error, azureStorage.BlobService.BlobResult>> {
  // tslint:disable-next-line: no-let
  let logger: Context["log"] | undefined;
  const contextTransport = new AzureContextTransport(() => logger, {
    level: "debug"
  });
  winston.add(contextTransport);
  logger = context.log;

  // tslint:disable-next-line: no-commented-code
  winston.debug(
    `getQueueSpidMessagesHandler|queueMessage|${JSON.stringify(spidMsgItem)}`
  );
  const today = new Date().toISOString().substring(0, 10);
  // tslint:disable-next-line: prefer-immediate-return
  const promise: Promise<
    Either<Error, azureStorage.BlobService.BlobResult>
  > = appendSpidBlob(
    blobService,
    SPID_BLOB_CONTAINER_NAME,
    today,
    JSON.stringify(spidMsgItem)
  );
  context.done();
  return promise;
}
