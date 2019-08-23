import { Context } from "@azure/functions";
import { createBlobService } from "azure-storage";

import * as express from "express";
import * as winston from "winston";

import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { secureExpressApp } from "io-functions-commons/dist/src/utils/express";
import { AzureContextTransport } from "io-functions-commons/dist/src/utils/logging";
import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";

import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";

import { GetVisibleServices } from "./handler";

// Setup Express
const app = express();
secureExpressApp(app);

const storageConnectionString = getRequiredStringEnv("QueueStorageConnection");
const blobService = createBlobService(storageConnectionString);

app.get("/api/v1/services", GetVisibleServices(blobService));

const azureFunctionHandler = createAzureFunctionHandler(app);

// tslint:disable-next-line: no-let
let logger: Context["log"] | undefined;
const contextTransport = new AzureContextTransport(() => logger, {
  level: "debug"
});
winston.add(contextTransport);

// Binds the express app to an Azure Function handler
function httpStart(context: Context): void {
  logger = context.log;
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
