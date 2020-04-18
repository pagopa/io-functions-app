import { Context } from "@azure/functions";

import * as express from "express";

import { DocumentClient as DocumentDBClient } from "documentdb";

import {
  USER_DATA_PROCESSING_COLLECTION_NAME,
  UserDataProcessingModel
} from "io-functions-commons/dist/src/models/user_data_processing";

import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { secureExpressApp } from "io-functions-commons/dist/src/utils/express";
import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";

import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";

import { GetUserDataProcessing } from "./handler";

const cosmosDbUri = getRequiredStringEnv("COSMOSDB_URI");
const cosmosDbKey = getRequiredStringEnv("COSMOSDB_KEY");
const cosmosDbName = getRequiredStringEnv("COSMOSDB_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const userDataProcessingsCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  USER_DATA_PROCESSING_COLLECTION_NAME
);

const documentClient = new DocumentDBClient(cosmosDbUri, {
  masterKey: cosmosDbKey
});

const userDataProcessingModel = new UserDataProcessingModel(
  documentClient,
  userDataProcessingsCollectionUrl
);

// Setup Express
const app = express();
secureExpressApp(app);

app.get(
  "/api/v1/user-data-processing/:fiscalcode/:choice",
  GetUserDataProcessing(userDataProcessingModel)
);

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
function httpStart(context: Context): void {
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
