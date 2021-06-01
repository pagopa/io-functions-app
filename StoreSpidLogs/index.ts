import { Context } from "@azure/functions";
import { sequenceS } from "fp-ts/lib/Apply";
import { either } from "fp-ts/lib/Either";
import { curry } from "fp-ts/lib/function";
import * as t from "io-ts";
import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import {
  EncryptedPayload,
  toEncryptedPayload
} from "@pagopa/ts-commons/lib/encrypt";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { IPString, PatternString } from "@pagopa/ts-commons/lib/strings";
import { initTelemetryClient } from "../utils/appinsights";
import { getConfigOrThrow } from "../utils/config";

const config = getConfigOrThrow();
const encrypt = curry(toEncryptedPayload)(config.SPID_LOGS_PUBLIC_KEY);

/**
 * Payload of the stored blob item
 * (one for each SPID request or response).
 */
const SpidBlobItem = t.interface({
  // Timestamp of Request/Response creation
  createdAt: UTCISODateFromString,

  // IP of the client that made a SPID login action
  ip: IPString,

  // XML payload of the SPID Request
  encryptedRequestPayload: EncryptedPayload,

  // XML payload of the SPID Response
  encryptedResponsePayload: EncryptedPayload,

  // SPID request ID
  spidRequestId: t.string
});

export type SpidBlobItem = t.TypeOf<typeof SpidBlobItem>;

/**
 * Payload of the message retrieved from the queue
 * (one for each SPID request or response).
 */
const SpidMsgItem = t.intersection([
  t.interface({
    // Timestamp of Request/Response creation
    createdAt: UTCISODateFromString,

    // Date of the SPID request / response in YYYY-MM-DD format
    createdAtDay: PatternString("^[0-9]{4}-[0-9]{2}-[0-9]{2}$"),

    // IP of the client that made a SPID login action
    ip: IPString,

    // XML payload of the SPID Request
    requestPayload: t.string,

    // XML payload of the SPID Response
    responsePayload: t.string,

    // SPID request ID
    spidRequestId: t.string
  }),
  t.partial({
    // SPID user fiscal code
    fiscalCode: t.string
  })
]);

export type SpidMsgItem = t.TypeOf<typeof SpidMsgItem>;

export interface IOutputBinding {
  spidRequestResponse: SpidBlobItem;
}

// Initialize application insights
initTelemetryClient();

/**
 * Store SPID request / responses, read from a queue, into a blob storage.
 */
export async function index(
  context: Context,
  spidMsgItem: SpidMsgItem
): Promise<void | IOutputBinding> {
  return sequenceS(either)({
    encryptedRequestPayload: encrypt(spidMsgItem.requestPayload),
    encryptedResponsePayload: encrypt(spidMsgItem.responsePayload)
  })
    .map(item => ({
      ...spidMsgItem,
      ...item
    }))
    .fold(
      err =>
        context.log.error(`StoreSpidLogs|ERROR=Cannot encrypt payload|${err}`),
      (encryptedBlobItem: SpidBlobItem) =>
        t
          .exact(SpidBlobItem)
          .decode(encryptedBlobItem)
          .fold(
            errs => {
              // unrecoverable error
              context.log.error(
                `StoreSpidLogs|ERROR=Cannot decode payload|ERROR_DETAILS=${readableReport(
                  errs
                )}`
              );
            },
            spidBlobItem => ({
              spidRequestResponse: spidBlobItem
            })
          )
    );
}
