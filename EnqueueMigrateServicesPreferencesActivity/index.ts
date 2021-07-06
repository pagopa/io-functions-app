import { QueueServiceClient } from "@azure/storage-queue";
import { getConfigOrThrow } from "../utils/config";
import { getEnqueueMigrateServicesPreferencesActivityHandler } from "./handler";

const config = getConfigOrThrow();
const queueServiceClient = QueueServiceClient.fromConnectionString(
  config.QueueStorageConnection
);

const activityFunction = getEnqueueMigrateServicesPreferencesActivityHandler(
  queueServiceClient,
  config.MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME
);

export default activityFunction;
