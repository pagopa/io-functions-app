import { BlobService } from "azure-storage";
import * as azureStorage from "azure-storage";
import { fromPredicate, TaskEither, taskify } from "fp-ts/lib/TaskEither";

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
  >(blobService.createContainerIfNotExists.bind(blobService));

  const doesBlobExist = taskify<
    string,
    string,
    Error,
    azureStorage.BlobService.BlobResult
  >(blobService.doesBlobExist.bind(blobService));

  const appendFromText = taskify<
    string,
    string,
    string,
    Error,
    azureStorage.BlobService.BlobResult
  >(blobService.appendFromText.bind(blobService));

  const createOrReplaceAppendBlob = taskify<
    string,
    string,
    Error,
    azureStorage.ServiceResponse
  >(blobService.createOrReplaceAppendBlob.bind(blobService));

  const append = () => appendFromText(containerName, blobName, spidMsgItem);
  return createContainerIfNotExists(containerName)
    .chain(() => doesBlobExist(containerName, blobName))
    .chain(result =>
      fromPredicate<Error, azureStorage.BlobService.BlobResult>(
        _ => _.exists === false,
        () => new Error()
      )(result).chainSecond(createOrReplaceAppendBlob(containerName, blobName))
    )
    .foldTaskEither(append, append);
}
