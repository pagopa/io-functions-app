import { Context } from "@azure/functions";

import * as express from "express";

import {
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";

import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";

import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";

import { getConfigOrThrow } from "../utils/config";

import { cosmosdbInstance } from "../utils/cosmosdb";
import { profileEmailTableClient } from "../utils/unique_email_enforcement";

import { GetProfile } from "./handler";

const config = getConfigOrThrow();
// Setup Express
const app = express();
secureExpressApp(app);

const profileModel = new ProfileModel(
  cosmosdbInstance.container(PROFILE_COLLECTION_NAME)
);

const profileEmailReader = new DataTableProfileEmailsRepository(
  profileEmailTableClient
);

app.get(
  "/api/v1/profiles/:fiscalcode",
  GetProfile(profileModel, config.OPT_OUT_EMAIL_SWITCH_DATE, profileEmailReader)
);

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
function httpStart(context: Context): void {
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
