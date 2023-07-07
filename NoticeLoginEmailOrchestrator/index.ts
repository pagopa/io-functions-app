import * as df from "durable-functions";

import { getNoticeLoginEmailOrchestratorHandler } from "./handler";

const orchestrator = df.orchestrator(getNoticeLoginEmailOrchestratorHandler);

export default orchestrator;
