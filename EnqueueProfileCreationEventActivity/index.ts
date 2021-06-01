import { QueueServiceClient } from "@azure/storage-queue";
import { getConfigOrThrow } from "../utils/config";
import { GetEnqueueProfileCreationEventActivityHandler } from "./handler";

const config = getConfigOrThrow();
const queueServiceClient = QueueServiceClient.fromConnectionString(
  config.QueueStorageConnection
);

const activityFunction = GetEnqueueProfileCreationEventActivityHandler(
  queueServiceClient
);

export default activityFunction;
