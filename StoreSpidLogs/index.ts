import { Context } from "@azure/functions";
import { fromNullable, isLeft } from "fp-ts/lib/Either";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { AzureContextTransport } from "io-functions-commons/dist/src/utils/logging";
import * as t from "io-ts";
import * as winston from "winston";

const SPID_BLOB_CONTAINER_NAME = getRequiredStringEnv(
  "SPID_BLOB_CONTAINER_NAME"
);

/**
 * This type wraps a Spid Request/Response message sent over an azure storage queue, namely "spidmsgitems"
 */
const SpidMsgItem = t.intersection([
  t.interface({
    createdAt: t.string, // The timestamp of Request/Response creation
    ip: t.string, // The client ip that made a Spid login action
    payload: t.string, // The xml payload of a Spid Request/Response
    payloadType: t.string, // The information about payload type: REQUEST | RESPONSE
    spidRequestId: t.string, // The SpiD unique identifier
    today: t.string // The today's date with YYYY-MM-DD format
  }),
  t.partial({
    fiscalCode: t.string // The user's fiscalCode
  })
]);

type SpidMsgItem = t.TypeOf<typeof SpidMsgItem>;

/**
 * This type wraps a Spid Blob item, stored in a Blob for each message
 */
const SpidBlobItem = t.interface({
  createdAt: t.string, // The timestamp of Request/Response creation
  ip: t.string, // The client ip that made a Spid login action
  payload: t.string, // The xml payload of a Spid Request/Response
  payloadType: t.string, // The nformation about payload type: REQUEST | RESPONSE
  spidRequestId: t.string // The SpiD request ID
});

type SpidBlobItem = t.TypeOf<typeof SpidBlobItem>;

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
export async function index(
  context: Context,
  spidMsgItem: SpidMsgItem
): Promise<Error | void> {
  logger = context.log;
  const spidBlobItemOrError = SpidBlobItem.decode({
    createdAt: spidMsgItem.createdAt,
    ip: spidMsgItem.ip,
    payload: spidMsgItem.payload,
    payloadType: spidMsgItem.payloadType,
    spidRequestId: spidMsgItem.spidRequestId
  });
  if (isLeft(spidBlobItemOrError)) {
    return Promise.reject("Cannot decode Spid blob payload");
  }
  const spidBlobItem = spidBlobItemOrError.value;
  if (spidMsgItem.fiscalCode) {
    // tslint:disable-next-line: no-object-mutation
    context.bindings[
      `${SPID_BLOB_CONTAINER_NAME}withfiscalcode`
    ] = spidBlobItem;
  } else {
    // tslint:disable-next-line: no-object-mutation
    context.bindings[SPID_BLOB_CONTAINER_NAME] = spidBlobItem;
  }
  context.done();
  return Promise.resolve();
}
