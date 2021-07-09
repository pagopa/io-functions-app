import { AzureFunction } from "@azure/functions";
import {
  SERVICE_PREFERENCES_COLLECTION_NAME,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { initTelemetryClient } from "../utils/appinsights";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { createTracker } from "../utils/tracking";
import { MigrateServicePreferenceFromLegacy } from "./handler";

const servicesPreferencesModel = new ServicesPreferencesModel(
  cosmosdbInstance.container(SERVICE_PREFERENCES_COLLECTION_NAME),
  SERVICE_PREFERENCES_COLLECTION_NAME
);

// Initialize application insights
const telemetryClient = initTelemetryClient();

const index: AzureFunction = MigrateServicePreferenceFromLegacy(
  servicesPreferencesModel,
  createTracker(telemetryClient)
);

export default index;
