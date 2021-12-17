import { Context } from "@azure/functions";
import * as express from "express";

import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import {
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  SERVICE_COLLECTION_NAME,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import {
  SERVICE_PREFERENCES_COLLECTION_NAME,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import { createTableService } from "azure-storage";
import {
  ActivationModel,
  ACTIVATION_COLLECTION_NAME
} from "@pagopa/io-functions-commons/dist/src/models/activation";
import { initTelemetryClient } from "../utils/appinsights";
import { getConfigOrThrow } from "../utils/config";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { UpsertServicePreferences } from "./handler";

// Setup Express
const app = express();
secureExpressApp(app);

const config = getConfigOrThrow();

// Setup Models
const profileModel = new ProfileModel(
  cosmosdbInstance.container(PROFILE_COLLECTION_NAME)
);
const serviceModel = new ServiceModel(
  cosmosdbInstance.container(SERVICE_COLLECTION_NAME)
);
const servicePreferencesModel = new ServicesPreferencesModel(
  cosmosdbInstance.container(SERVICE_PREFERENCES_COLLECTION_NAME),
  SERVICE_PREFERENCES_COLLECTION_NAME
);

const activationModel = new ActivationModel(
  cosmosdbInstance.container(ACTIVATION_COLLECTION_NAME)
);

const tableService = createTableService(config.QueueStorageConnection);
app.post(
  "/api/v1/profiles/:fiscalcode/services/:serviceId/preferences",
  UpsertServicePreferences(
    initTelemetryClient(),
    profileModel,
    serviceModel,
    servicePreferencesModel,
    activationModel,
    tableService,
    config.SUBSCRIPTIONS_FEED_TABLE
  )
);

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
function httpStart(context: Context): void {
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
