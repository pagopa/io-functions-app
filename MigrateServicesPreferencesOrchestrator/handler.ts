import { isLeft } from "fp-ts/lib/Either";

import * as df from "durable-functions";
import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";

import { readableReport } from "@pagopa/ts-commons/lib/reporters";

import { MigrateServicesPreferencesQueueMessage } from "../MigrateServicePreferenceFromLegacy/handler";

const LOG_PREFIX = "MigrateServicesPreferencesOrchestrator";

export const getMigrateServicesPreferencesOrchestratorHandler = () =>
  function*(context: IOrchestrationFunctionContext): Generator<unknown> {
    const retryOptions = new df.RetryOptions(5000, 10);
    // tslint:disable-next-line: no-object-mutation
    retryOptions.backoffCoefficient = 1.5;

    // Get and decode orchestrator input
    const input = context.df.getInput();
    const errorOrMigrateServicesProfilesInput = MigrateServicesPreferencesQueueMessage.decode(
      input
    );
    if (isLeft(errorOrMigrateServicesProfilesInput)) {
      context.log.error(
        `${LOG_PREFIX}|Error decoding input|ERROR=${readableReport(
          errorOrMigrateServicesProfilesInput.value
        )}`
      );
      return false;
    }

    const migrateServicesProfilesInput =
      errorOrMigrateServicesProfilesInput.value;

    yield context.df.callActivityWithRetry(
      "EnqueueMigrateServicesPreferencesActivity",
      retryOptions,
      migrateServicesProfilesInput
    );

    return true;
  };
