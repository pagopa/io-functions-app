import { Context } from "@azure/functions";

import * as express from "express";

import { secureExpressApp } from "io-functions-commons/dist/src/utils/express";
import { setAppContext } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";

import {
  MESSAGE_COLLECTION_NAME,
  MessageModel
} from "io-functions-commons/dist/src/models/message";

import { createBlobService } from "azure-storage";

import createAzureFunctionHandler from "io-functions-express/dist/src/createAzureFunctionsHandler";

import { cosmosdbInstance } from "../utils/cosmosdb";
import { GetMessage } from "./handler";

import { getConfigOrThrow } from "../utils/config";

// Setup Express
const app = express();
secureExpressApp(app);

const config = getConfigOrThrow();

const messageContainerName = config.MESSAGE_CONTAINER_NAME;

const messageModel = new MessageModel(
  cosmosdbInstance.container(MESSAGE_COLLECTION_NAME),
  messageContainerName
);

const storageConnectionString = config.QueueStorageConnection;
const blobService = createBlobService(storageConnectionString);

app.get(
  "/api/v1/messages/:fiscalcode/:id",
  GetMessage(messageModel, blobService)
);

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
function httpStart(context: Context): void {
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
