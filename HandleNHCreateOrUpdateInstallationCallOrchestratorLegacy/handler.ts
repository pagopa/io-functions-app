import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";

import * as df from "durable-functions";
import { readableReport } from "italia-ts-commons/lib/reporters";

import { CreateOrUpdateInstallationMessage } from "../generated/notifications/CreateOrUpdateInstallationMessage";
import { activityName as CreateOrUpdateActivityName } from "../HandleNHCreateOrUpdateInstallationCallActivityLegacy/index";

/**
 * Carries information about Notification Hub Message payload
 */
export const NhCreateOrUpdateInstallationOrchestratorCallLegacyInput = t.interface(
  {
    message: CreateOrUpdateInstallationMessage
  }
);

export type NhCreateOrUpdateInstallationOrchestratorCallLegacyInput = t.TypeOf<
  typeof NhCreateOrUpdateInstallationOrchestratorCallLegacyInput
>;

export const handler = function*(
  context: IOrchestrationFunctionContext
): Generator<unknown> {
  const logPrefix = `NhCreateOrUpdateInstallationOrchestratorLegacyCallInput`;

  const retryOptions = {
    ...new df.RetryOptions(5000, 10),
    backoffCoefficient: 1.5
  };

  // Get and decode orchestrator input
  const input = context.df.getInput();
  const errorOrNHCreateOrUpdateCallOrchestratorInput = NhCreateOrUpdateInstallationOrchestratorCallLegacyInput.decode(
    input
  );

  if (isLeft(errorOrNHCreateOrUpdateCallOrchestratorInput)) {
    logError(context, logPrefix, errorOrNHCreateOrUpdateCallOrchestratorInput);
    return false;
  }

  const nhCallOrchestratorInput =
    errorOrNHCreateOrUpdateCallOrchestratorInput.value;

  yield context.df.callActivityWithRetry(
    CreateOrUpdateActivityName,
    retryOptions,
    nhCallOrchestratorInput
  );

  return true;
};

function logError(
  context: IOrchestrationFunctionContext,
  logPrefix: string,
  errorOrNHCallOrchestratorInput
) {
  context.log.error(`${logPrefix}|Error decoding input`);
  context.log.verbose(
    `${logPrefix}|Error decoding input|ERROR=${readableReport(
      errorOrNHCallOrchestratorInput.value
    )}`
  );
}
