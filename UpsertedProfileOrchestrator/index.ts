import * as df from "durable-functions";
import { getConfigOrThrow } from "../utils/config";

import { getUpsertedProfileOrchestratorHandler } from "./handler";

const config = getConfigOrThrow();

const orchestrator = df.orchestrator(
  getUpsertedProfileOrchestratorHandler({
    notifyOn: config.IS_EUCOVIDCERT_ENABLED
      ? [config.EUCOVIDCERT_NOTIFY_QUEUE_NAME]
      : [],
    sendCashbackMessage: config.IS_CASHBACK_ENABLED
  })
);

export default orchestrator;
