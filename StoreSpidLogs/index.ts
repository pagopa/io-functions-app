import { Context } from "@azure/functions";
import { createBlobService } from "azure-storage";
import * as azureStorage from "azure-storage";
import { format } from "date-fns";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { AzureContextTransport } from "io-functions-commons/dist/src/utils/logging";
import * as t from "io-ts";
import * as winston from "winston";
import { appendSpidBlob } from "../utils/spid_blob_storage";

const SPID_BLOB_STORAGE_CONNECTION_STRING = getRequiredStringEnv(
  "QueueStorageConnection"
);

const SPID_BLOB_CONTAINER_NAME = getRequiredStringEnv(
  "SPID_BLOB_CONTAINER_NAME"
);

const blobService = createBlobService(SPID_BLOB_STORAGE_CONNECTION_STRING);

/**
 * This type wraps a Spid Request/Response message sent over an azure storage queue, namely "spidmsgitems"
 */
const SpidMsgItem = t.interface({
  ip: t.string, // The client ip that made a Spid login action
  payload: t.string, // The xml payload of a Spid Request/Response
  timestamp: t.string // The timestamp of Request/Response creation
});

type SpidMsgItem = t.TypeOf<typeof SpidMsgItem>;

// tslint:disable-next-line: no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

/**
 * Handler that gets triggered on incoming spid Request/Response Message by polling every xxx seconds
 * for new messages in spimsgitems azure storage queue.
 * It handles call to utility that manages blob's related operations.
 * Store SPID request / responses, read from a queue, into a blob storage.
 */
export function index(
  context: Context,
  spidMsgItem: SpidMsgItem
): Promise<azureStorage.BlobService.BlobResult> {
  logger = context.log;
  const today = format(new Date(), "YYYY-MM-DD");
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
