import { Context } from "@azure/functions";
import { createBlobService } from "azure-storage";
import * as azureStorage from "azure-storage";
import { format } from "date-fns";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { AzureContextTransport } from "io-functions-commons/dist/src/utils/logging";
import * as t from "io-ts";
import * as winston from "winston";
import { appendSpidBlob } from "../utils/spid_blob_storage";

const AZURE_STORAGE_CONNECTION_STRING = getRequiredStringEnv(
  "QueueStorageConnection"
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

// tslint:disable-next-line: no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

/**
 * Handler that gets triggered on incoming event.
 */
export function index(
  context: Context,
  spidMsgItem: SpidMsgItem
): Promise<azureStorage.BlobService.BlobResult> {
  logger = context.log;
  winston.debug(
    `getQueueSpidMessagesHandler|queueMessage|${JSON.stringify(spidMsgItem)}`
  );
  const today = format(new Date(), "yyyy-MM-dd");
  return appendSpidBlob(
    blobService,
    SPID_BLOB_CONTAINER_NAME,
    today,
    JSON.stringify(spidMsgItem)
  )
    .fold(
      l => {
        throw l;
      },
      a => {
        context.done();
        return a;
      }
    )
    .run();
}
