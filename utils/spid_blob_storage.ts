import { BlobService } from "azure-storage";
import * as azureStorage from "azure-storage";
import { TaskEither, taskify } from "fp-ts/lib/TaskEither";

/**
 * Provides all the capabilities to manage an azure append blob for Spid Request/Response auditing.
 * It creates a new container if it is missing, based on the provided containerName.
 * If the blob identified by blobName is missing, it creates a new append blob and writes spidMsgItem, otherwise
 * it only append spidMsgItem to the existing blob.
 * @param blobService: The blob service created from a valid azure connection string
 * @param containerName: The container instance name that contains blobs
 * @param blobName: The blob name that should be created or, if already existing, requested for appending new blob data
 * @param spidMsgItem: The message item containing informations about SpiD Request/Response
 */
export function appendSpidBlob(
  blobService: BlobService,
  containerName: string,
  blobName: string,
  spidMsgItem: string
): TaskEither<Error, azureStorage.BlobService.BlobResult> {
  const createContainerIfNotExists = taskify<
    string,
    Error,
    azureStorage.BlobService.ContainerResult
  >(blobService.createContainerIfNotExists);

  const doesBlobExist = taskify<
    string,
    string,
    Error,
    azureStorage.BlobService.BlobResult
  >(blobService.doesBlobExist);

  return createContainerIfNotExists(containerName)
    .chain(() => doesBlobExist(containerName, blobName))
    .chain(result =>
      result.exists
        ? appendMsgToSpidBlob(blobService, containerName, blobName, spidMsgItem)
        : createAndAppendMsgToNewSpidBlob(
            blobService,
            containerName,
            blobName,
            spidMsgItem
          )
    );
}

/**
 * This method creates a new blob by the provided blobName in a given conatinerName and append a new spid message item.
 * @param blobService: The blob service created from a valid azure connection string
 * @param containerName: The container instance name that contains blobs
 * @param blobName: The blob name that should be created or, if already existing, requested for appending new blob data
 * @param spidMsgItem: The message item containing informations about SpiD Request/Response
 */
export function createAndAppendMsgToNewSpidBlob(
  blobService: BlobService,
  containerName: string,
  blobName: string,
  spidMsgItem: string
): TaskEither<Error, azureStorage.BlobService.BlobResult> {
  const createAppendBlobFromText = taskify<
    string,
    string,
    string,
    Error,
    azureStorage.BlobService.BlobResult
  >(blobService.createAppendBlobFromText);
  return createAppendBlobFromText(containerName, blobName, spidMsgItem);
}

/**
 * This method append a spid message item to an existing blob identified by blobName in a given containerName.
 * @param blobService: The blob service created from a valid azure connection string
 * @param containerName: The container instance name that contains blobs
 * @param blobName: The blob name that should be created or, if already existing, requested for appending new blob data
 * @param spidMsgItem: The message item containing informations about SpiD Request/Response
 */
export function appendMsgToSpidBlob(
  blobService: BlobService,
  containerName: string,
  blobName: string,
  spidMsgItem: string
): TaskEither<Error, azureStorage.BlobService.BlobResult> {
  const appendFromText = taskify<
    string,
    string,
    string,
    Error,
    azureStorage.BlobService.BlobResult
  >(blobService.appendFromText);
  return appendFromText(containerName, blobName, spidMsgItem);
}
