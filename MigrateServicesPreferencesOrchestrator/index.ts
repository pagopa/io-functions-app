import * as df from "durable-functions";

import { getMigrateServicesPreferencesOrchestratorHandler } from "./handler";

const orchestrator = df.orchestrator(
  getMigrateServicesPreferencesOrchestratorHandler()
);

export default orchestrator;
