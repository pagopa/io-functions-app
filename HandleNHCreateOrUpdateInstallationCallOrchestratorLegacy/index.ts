import * as df from "durable-functions";

import { handler } from "./handler";

const orchestrator = df.orchestrator(handler);

export const orchestratorName =
  "HandleNHCreateOrUpdateInstallationCallOrchestratorLegacy";

export default orchestrator;
