import { Context } from "@azure/functions";

import * as t from "io-ts";

import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import { IPString, PatternString } from "@pagopa/ts-commons/lib/strings";

import { initTelemetryClient } from "../utils/appinsights";
import { getConfigOrThrow } from "../utils/config";
import { encryptAndStore } from "./handler";

const config = getConfigOrThrow();

/**
 * Payload of the message retrieved from the queue
 * (one for each SPID request or response).
 */
export const SpidMsgItem = t.intersection([
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

// Initialize application insights
initTelemetryClient();

/**
 * Store SPID request / responses, read from a queue, into a blob storage.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const index = (context: Context, spidMsgItem: SpidMsgItem) =>
  encryptAndStore(context, spidMsgItem, config.SPID_LOGS_PUBLIC_KEY);
