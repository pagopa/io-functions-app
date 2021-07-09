import { AzureFunction } from "@azure/functions";
import {
  SERVICE_PREFERENCES_COLLECTION_NAME,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { MigrateServicePreferenceFromLegacy } from "./handler";

const servicesPreferencesModel = new ServicesPreferencesModel(
  cosmosdbInstance.container(SERVICE_PREFERENCES_COLLECTION_NAME),
  SERVICE_PREFERENCES_COLLECTION_NAME
);

const index: AzureFunction = MigrateServicePreferenceFromLegacy(
  servicesPreferencesModel
);

export default index;
