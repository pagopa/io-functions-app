import { Context } from "@azure/functions";
import * as crypto from "crypto";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { AzureContextTransport } from "io-functions-commons/dist/src/utils/logging";
import * as t from "io-ts";
import { UTCISODateFromString } from "italia-ts-commons/lib/dates";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { IPString, PatternString } from "italia-ts-commons/lib/strings";
import * as winston from "winston";

// tslint:disable-next-line: no-commented-code
// const rsaPublicKey = getRequiredStringEnv("RSA_PUBLIC_KEY");

/**
 * Encrypt a given string with RSA Public key
 * @param payload: a json payload to encrypt with public key
 */
const encryptWithRsaPublicKey = (payload: string) => {
  return crypto
    .publicEncrypt(
      {
        key: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAi5NKxxANte+B7T1R7/oV
BcEnobW83gF/G7uiWj0uprprhkN01El6OybHUI3XikPXXwQB7VdBFFuyNuuLXw3n
B0Ed4sIVsaGnNqYkeGJ/+RD/9ptjWR/QNCZ5a50mGv1MuOD2Us4zRAmOLTbbKz0Q
GCNfojkrDgwlNKDwNyJ9GCUkOqtf+CfeU7ntKK/3LQrarHrG2ybrtHQIq9v/NIrk
GKuAsCBHn30CrFWWQA+4J4w8YAoP0CiA2DMRYlzJG7/sKAyu4FIT3eCHYCqPjqNl
ccxJbYWiN26GbFNgYg1uN1zh3Y6rIPf8RQa2Z4rJ6N957HqeGtEct+8/CZFuzX9p
0wIDAQAB
-----END PUBLIC KEY-----`,
        padding: crypto.constants.RSA_NO_PADDING
      },
      Buffer.from(payload)
    )
    .toString("base64");
};
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

const OutputBinding = t.interface({
  spidRequestResponse: t.string
});

export type OutputBinding = t.TypeOf<typeof OutputBinding>;

/**
 * Store SPID request / responses, read from a queue, into a blob storage.
 */
export async function index(
  context: Context,
  spidMsgItem: SpidMsgItem
): Promise<void | OutputBinding> {
  logger = context.log;
  return t
    .exact(SpidBlobItem)
    .decode(spidMsgItem)
    .fold<void | OutputBinding>(
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
          spidRequestResponse: encryptWithRsaPublicKey(
            JSON.stringify(spidBlobItem)
          )
        };
      }
    );
}
