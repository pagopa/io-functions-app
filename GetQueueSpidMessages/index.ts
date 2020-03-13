import { Context } from "@azure/functions";
import { BlobService, createBlobService } from "azure-storage";
import * as azureStorage from "azure-storage";
import { Either, fromNullable, left, right } from "fp-ts/lib/Either";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { AzureContextTransport } from "io-functions-commons/dist/src/utils/logging";
import * as t from "io-ts";
import * as winston from "winston";

const AZURE_STORAGE_CONNECTION_STRING = getRequiredStringEnv(
  "AzureWebJobsStorage"
);

const blobService = createBlobService(AZURE_STORAGE_CONNECTION_STRING);

const SpidMsgItem = t.interface({
  ip: t.string,
  payload: t.string,
  timestamp: t.string
});

type SpidMsgItem = t.TypeOf<typeof SpidMsgItem>;
/**
 * Handler that gets triggered on incoming event.
 */
export async function index(
  context: Context,
  spidMsgItem: SpidMsgItem
): Promise<Either<Error, azureStorage.BlobService.BlobResult>> {
  // tslint:disable-next-line: no-let
  let logger: Context["log"] | undefined;
  const contextTransport = new AzureContextTransport(() => logger, {
    level: "debug"
  });
  winston.add(contextTransport);
  logger = context.log;

  // tslint:disable-next-line: no-commented-code
  winston.debug(
    `getQueueSpidMessagesHandler|queueMessage|${JSON.stringify(spidMsgItem)}`
  );

  winston.debug(
    `getQueueSpidMessagesHandler|bindings|${JSON.stringify(context.bindings)}`
  );
  const today = new Date().toISOString().substring(0, 10);

  blobService.createContainerIfNotExists("spidblob", (err, result, __) => {
    if (err) {
      throw err;
    }
  });
  // tslint:disable-next-line: prefer-immediate-return
  const promise: Promise<
    Either<Error, azureStorage.BlobService.BlobResult>
    // tslint:disable-next-line: prefer-immediate-return
  > = new Promise(resolve =>
    blobService.appendFromText(
      "spidblob",
      today,
      JSON.stringify(spidMsgItem),
      (e, r, res) => {
        if (e) {
          return resolve(left<Error, azureStorage.BlobService.BlobResult>(e));
        } else {
          return resolve(right<Error, azureStorage.BlobService.BlobResult>(r));
        }
        // tslint:disable-next-line: prettier
      })
  );
  // blobService.doesBlobExist("spidblob", today, (err, result, __) => {
  //   winston.debug(
  //     `call to doesBlobExists => err = ${err} , result is = ${result}`
  //   );
  //   if (err) {
  //     return resolve(left<Error, azureStorage.BlobService.BlobResult>(err));
  //   } else {
  //     const isBlobPresent = right<Error, azureStorage.BlobService.BlobResult>(
  //       result
  //     ).value;

  //     winston.debug(`isBlobPresent is equal to ${isBlobPresent}`);
  //     if (isBlobPresent) {
  //     } else {
  //       blobService.createAppendBlobFromText(
  //         "spidblob",
  //         today,
  //         JSON.stringify(spidMsgItem),
  //         (error, errorOrResult, response) => {
  //           if (error) {
  //             return resolve(
  //               left<Error, azureStorage.BlobService.BlobResult>(error)
  //             );
  //           } else {
  //             return resolve(
  //               right<Error, azureStorage.BlobService.BlobResult>(
  //                 errorOrResult
  //               )
  //             );
  //           }
  //         }
  //       );
  //     }
  //   }
  // })
  // );

  context.done();
  return promise;
}
