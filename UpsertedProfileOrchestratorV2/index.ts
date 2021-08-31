import * as df from "durable-functions";

import * as O from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/function";
import * as NonEmptyArray from "fp-ts/lib/NonEmptyArray";

import { getConfigOrThrow } from "../utils/config";

import { getUpsertedProfileOrchestratorHandler } from "./handler";

const config = getConfigOrThrow();

const orchestrator = df.orchestrator(
  getUpsertedProfileOrchestratorHandler({
    notifyOn: config.FF_NEW_USERS_EUCOVIDCERT_ENABLED
      ? pipe(
          NonEmptyArray.fromArray([
            config.EUCOVIDCERT_PROFILE_CREATED_QUEUE_NAME
          ]),
          O.getOrElseW(() => undefined)
        )
      : undefined,
    sendCashbackMessage: config.IS_CASHBACK_ENABLED
  })
);

export default orchestrator;
