import { Context } from "@azure/functions";
import createAzureFunctionHandler from "@pagopa/express-azure-functions/dist/src/createAzureFunctionsHandler";
import { secureExpressApp } from "@pagopa/io-functions-commons/dist/src/utils/express";
import { setAppContext } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import * as express from "express";
import { initTelemetryClient } from "../utils/appinsights";
import { createTracker } from "../utils/tracking";
import { NoticeLoginEmail } from "./handler";

// Initialize application insights
const telemetryClient = initTelemetryClient();

// Setup Express
const app = express();
secureExpressApp(app);
app.post(
  "/api/v1/notify-login",
  NoticeLoginEmail(createTracker(telemetryClient))
);

const azureFunctionHandler = createAzureFunctionHandler(app);

// Binds the express app to an Azure Function handler
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
function httpStart(context: Context): void {
  setAppContext(app, context);
  azureFunctionHandler(context);
}

export default httpStart;
