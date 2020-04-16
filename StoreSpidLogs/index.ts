import { Context } from "@azure/functions";
import * as ai from "applicationinsights";
import { isLeft } from "fp-ts/lib/Either";
import { curry } from "fp-ts/lib/function";
import { initAppInsights } from "io-functions-commons/dist/src/utils/application_insights";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import {
  EncryptedPayload,
  toEncryptedPayload
} from "italia-ts-commons/lib/encrypt";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { IPString, PatternString } from "italia-ts-commons/lib/strings";

const rsaPublicKey = getRequiredStringEnv("SPID_LOGS_PUBLIC_KEY");
const encrypt = curry(toEncryptedPayload)(rsaPublicKey);

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
  const errorOrEncryptedRequestPayload = encrypt(spidMsgItem.requestPayload);
  const errorOrEncryptedResponsePayload = encrypt(spidMsgItem.responsePayload);
  if (
    isLeft(errorOrEncryptedRequestPayload) ||
    isLeft(errorOrEncryptedResponsePayload)
  ) {
    context.log.error(
      `StoreSpidLogs|ERROR=Cannot encrypt SPID request/response payload|${errorOrEncryptedRequestPayload.value}`
    );
    return;
  }
  const encryptedBlobItem: SpidBlobItem = {
    ...spidMsgItem,
    encryptedRequestPayload: errorOrEncryptedRequestPayload.value,
    encryptedResponsePayload: errorOrEncryptedResponsePayload.value
  };
  return t
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
    );
}
