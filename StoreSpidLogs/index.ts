import { Context } from "@azure/functions";
import { AzureContextTransport } from "io-functions-commons/dist/src/utils/logging";
import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { IPString, PatternString } from "italia-ts-commons/lib/strings";
import * as winston from "winston";

/**
 * This type wraps a Spid Request/Response message sent over an azure storage queue, namely "spidmsgitems"
 */
const SpidMsgItem = t.intersection([
  t.interface({
    createdAt: t.string, // The timestamp of Request/Response creation
    createdAtDay: PatternString("^[0-9]{4}-[0-9]{2}-[0-9]{2}$"), // The today's date expression in YYYY-MM-DD format
    ip: IPString, // The client ip that made a Spid login action
    payload: t.string, // The xml payload of a Spid Request/Response
    payloadType: t.keyof({ REQUEST: null, RESPONSE: null }), // The information about payload type: REQUEST | RESPONSE
    spidRequestId: t.string // The SpiD unique identifier
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
  createdAt: UTCISODateFromString, // The timestamp of Request/Response creation
  ip: IPString, // The client ip that made a Spid login action
  payload: t.string, // The xml payload of a Spid Request/Response
  payloadType: t.keyof({ REQUEST: null, RESPONSE: null }), // The nformation about payload type: REQUEST | RESPONSE
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

  const spidBlobItem = spidBlobItemOrError.fold(
    errs => {
      context.log.error(
        "Cannot decode Spid blob payload: ",
        readableReport(errs)
      );
      return void 0;
    },
    item => item
  );
  if (spidMsgItem.fiscalCode) {
    // tslint:disable-next-line: no-object-mutation
    context.bindings.spidresponse = spidBlobItem;
  } else {
    // tslint:disable-next-line: no-object-mutation
    context.bindings.spidrequest = spidBlobItem;
  }
  context.done();
}
