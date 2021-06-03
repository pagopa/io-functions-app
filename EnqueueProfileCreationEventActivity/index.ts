import { QueueServiceClient } from "@azure/storage-queue";
import { getConfigOrThrow } from "../utils/config";
import { GetEnqueueProfileCreationEventActivityHandler } from "./handler";

const config = getConfigOrThrow();
const eventsQueueServiceClient = QueueServiceClient.fromConnectionString(
  config.EventsQueueStorageConnection
);

const activityFunction = GetEnqueueProfileCreationEventActivityHandler(
  eventsQueueServiceClient
);

export default activityFunction;
