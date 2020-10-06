import { Context } from "@azure/functions";
import { createBlobService } from "azure-storage";

import * as express from "express";

import { secureExpressApp } from "io-functions-commons/dist/src/utils/express";
import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";

import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";

import { GetVisibleServices } from "./handler";

import { getConfigOrThrow } from "../utils/config";

// Setup Express
const app = express();
secureExpressApp(app);

const config = getConfigOrThrow();

const storageConnectionString = config.QueueStorageConnection;
const blobService = createBlobService(storageConnectionString);

app.get("/api/v1/services", GetVisibleServices(blobService));

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
function httpStart(context: Context): void {
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
