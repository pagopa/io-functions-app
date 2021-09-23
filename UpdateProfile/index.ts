import { Context } from "@azure/functions";
import {
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import * as express from "express";
            // eslint-disable-next-line import/order
import { initTelemetryClient } from "../utils/appinsights";

import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";

import { QueueServiceClient } from "@azure/storage-queue";
import { getConfigOrThrow } from "../utils/config";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { createTracker } from "../utils/tracking";

import { UpdateProfile } from "./handler";

const config = getConfigOrThrow();

const profileModel = new ProfileModel(
  cosmosdbInstance.container(PROFILE_COLLECTION_NAME)
);

const queueClient = QueueServiceClient.fromConnectionString(
  config.FN_APP_STORAGE_CONNECTION_STRING
).getQueueClient(config.MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME);

// Initialize application insights
const telemetryClient = initTelemetryClient();

// Setup Express
const app = express();
secureExpressApp(app);
app.put(
  "/api/v1/profiles/:fiscalcode",
  UpdateProfile(profileModel, queueClient, createTracker(telemetryClient))
);

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
            // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
function httpStart(context: Context): void {
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
