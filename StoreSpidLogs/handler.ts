import { Context } from "@azure/functions";
import {
  EncryptedPayload,
  toEncryptedPayload
} from "@pagopa/ts-commons/lib/encrypt";
import { IPString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { curry } from "fp-ts/lib/function";
import * as t from "io-ts";
import { SpidMsgItem } from "./index";

import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { sequenceS } from "fp-ts/lib/Apply";
import { either } from "fp-ts/lib/Either";

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

export interface IOutputBinding {
  spidRequestResponse: SpidBlobItem;
}

export const encryptAndStore = async (
  context: Context,
  spidMsgItem: SpidMsgItem,
  spidLogsPublicKey: NonEmptyString
): Promise<void | IOutputBinding> => {
  const encrypt = curry(toEncryptedPayload)(spidLogsPublicKey);
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
};
