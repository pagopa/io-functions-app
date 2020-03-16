import { BlobService } from "azure-storage";
import * as azureStorage from "azure-storage";
import { Either, either, left, right } from "fp-ts/lib/Either";

export function appendSpidBlob(
  blobService: BlobService,
  containerName: string,
  blobName: string,
  spidMsgItem: string
): Promise<Either<Error, azureStorage.BlobService.BlobResult>> {
  return new Promise(resolve => {
    blobService.createContainerIfNotExists(containerName, (err, _, __) => {
      if (err) {
        return resolve(left<Error, azureStorage.BlobService.BlobResult>(err));
      }
    });
    blobService.doesBlobExist(containerName, blobName, (err, result, __) => {
      if (err) {
        return resolve(left<Error, azureStorage.BlobService.BlobResult>(err));
      } else {
        if (result.exists) {
          resolve(
            appendMsgToSpidBlob(
              blobService,
              containerName,
              blobName,
              spidMsgItem
            )
          );
        } else {
          resolve(
            createAndAppendMsgToNewSpidBlob(
              blobService,
              containerName,
              blobName,
              spidMsgItem
            )
          );
        }
      }
    });
  });
}

export function createAndAppendMsgToNewSpidBlob(
  blobService: BlobService,
  containerName: string,
  blobName: string,
  spidMsgItem: string
): Either<Error, azureStorage.BlobService.BlobResult> {
  blobService.createAppendBlobFromText(
    containerName,
    blobName,
    JSON.stringify(spidMsgItem),
    (error, errorOrResult, ___) => {
      return error
        ? left<Error, azureStorage.BlobService.BlobResult>(error)
        : right<Error, azureStorage.BlobService.BlobResult>(errorOrResult);
    }
  );
  return left<Error, azureStorage.BlobService.BlobResult>(
    new Error("Error while appending spidMsg to new Blob")
  );
}

export function appendMsgToSpidBlob(
  blobService: BlobService,
  containerName: string,
  blobName: string,
  spidMsgItem: string
): Either<Error, azureStorage.BlobService.BlobResult> {
  blobService.appendFromText(
    containerName,
    blobName,
    JSON.stringify(spidMsgItem),
    (err, res, ___) => {
      return err
        ? left<Error, azureStorage.BlobService.BlobResult>(err)
        : right<Error, azureStorage.BlobService.BlobResult>(res);
    }
  );
  return left<Error, azureStorage.BlobService.BlobResult>(
    new Error("Error while appending spidMsg to existing Blob")
  );
}
