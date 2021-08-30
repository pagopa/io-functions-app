import { Context } from "@azure/functions";

import * as express from "express";

import {
  USER_DATA_PROCESSING_COLLECTION_NAME,
  UserDataProcessingModel
} from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";

import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";

import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";

import { cosmosdbInstance } from "../utils/cosmosdb";
import { GetUserDataProcessing } from "./handler";

const userDataProcessingModel = new UserDataProcessingModel(
  cosmosdbInstance.container(USER_DATA_PROCESSING_COLLECTION_NAME)
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
