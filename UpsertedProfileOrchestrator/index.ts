import * as df from "durable-functions";
import { getConfigOrThrow } from "../utils/config";
import { getUpsertedProfileOrchestratorHandler } from "./handler";

const config = getConfigOrThrow();

const orchestrator = df.orchestrator(
  getUpsertedProfileOrchestratorHandler({
    sendCashbackMessage: config.IS_CASHBACK_ENABLED
  })
);

export default orchestrator;
