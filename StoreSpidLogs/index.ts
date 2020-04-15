import { Context } from "@azure/functions";
import * as ai from "applicationinsights";
import { initAppInsights } from "io-functions-commons/dist/src/utils/application_insights";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { AzureContextTransport } from "io-functions-commons/dist/src/utils/logging";
import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { IPString, PatternString } from "italia-ts-commons/lib/strings";
import * as NodeRSA from "node-rsa";
import * as winston from "winston";

const rsaPublicKey = new NodeRSA(getRequiredStringEnv("SPID_LOGS_PUBLIC_KEY"));
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
  requestPayload: t.string,

  // XML payload of the SPID Response
  responsePayload: t.string,

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
    // Date of the SPID request / response in YYYY-MM-DD format
    createdAtDay: PatternString("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
  }),
  SpidBlobItem,
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
  const encryptedMsgItem: SpidMsgItem = {
    ...spidMsgItem,
    requestPayload: rsaPublicKey.encrypt(spidMsgItem.requestPayload, "base64"),
    responsePayload: rsaPublicKey.encrypt(spidMsgItem.responsePayload, "base64")
  };
  return t
    .exact(SpidBlobItem)
    .decode(encryptedMsgItem)
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
