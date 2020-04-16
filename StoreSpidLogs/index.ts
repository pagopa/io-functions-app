import { Context } from "@azure/functions";
import * as ai from "applicationinsights";
import { isLeft } from "fp-ts/lib/Either";
import { initAppInsights } from "io-functions-commons/dist/src/utils/application_insights";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { AzureContextTransport } from "io-functions-commons/dist/src/utils/logging";
import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { toEncryptedPayload } from "italia-ts-commons/lib/encrypt";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { IPString, PatternString } from "italia-ts-commons/lib/strings";
import * as winston from "winston";

const rsaPublicKey = getRequiredStringEnv("SPID_LOGS_PUBLIC_KEY");

const EncryptedPayload = t.interface({
  // Hybrid encrypted result (Base64)
  cypherText: t.string,

  // random AES string (Base64)
  iv: t.string,

  // AES Key encrypted with RSA public key (Base64)
  encryptedKey: t.string
});

export type EncryptedPayload = t.TypeOf<typeof EncryptedPayload>;
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

// tslint:disable-next-line: no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

export interface IOutputBinding {
  spidRequestResponse: SpidBlobItem;
}

// Avoid to initialize Application Insights more than once
if (!ai.defaultClient) {
  initAppInsights(getRequiredStringEnv("APPINSIGHTS_INSTRUMENTATIONKEY"));
}

/**
 * Store SPID request / responses, read from a queue, into a blob storage.
 */
export async function index(
  context: Context,
  spidMsgItem: SpidMsgItem
): Promise<void | IOutputBinding> {
  logger = context.log;
  const errorOrEncryptedRequestPayload = toEncryptedPayload(
    rsaPublicKey,
    spidMsgItem.requestPayload
  );
  const errorOrEncryptedResponsePayload = toEncryptedPayload(
    rsaPublicKey,
    spidMsgItem.responsePayload
  );
  if (
    isLeft(errorOrEncryptedRequestPayload) ||
    isLeft(errorOrEncryptedResponsePayload)
  ) {
    context.log.error(
      `StoreSpidLogs|ERROR=Cannot encrypt SpID request/response payload|${errorOrEncryptedRequestPayload.value}`
    );
    return void 0;
  }
  const encryptedBlobItem: SpidBlobItem = {
    ...spidMsgItem,
    encryptedRequestPayload: errorOrEncryptedRequestPayload.value,
    encryptedResponsePayload: errorOrEncryptedResponsePayload.value
  };
  return t
    .exact(SpidBlobItem)
    .decode(encryptedBlobItem)
    .fold<void | IOutputBinding>(
      errs => {
        // unrecoverable error
        context.log.error(
          `StoreSpidLogs|ERROR=Cannot decode payload|ERROR_DETAILS=${readableReport(
            errs
          )}`
        );
      },
      spidBlobItem => {
        return {
          spidRequestResponse: spidBlobItem
        };
      }
    );
}
