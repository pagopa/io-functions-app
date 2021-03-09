import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";

import * as df from "durable-functions";
import { readableReport } from "italia-ts-commons/lib/reporters";

import { NotifyMessage } from "../generated/notifications/NotifyMessage";

import { activityName as NotifyMessageActivityName } from "../HandleNHNotifyMessageCallActivityLegacy/index";

/**
 * Carries information about Notification Hub Message payload
 */
export const NhNotifyMessageOrchestratorCallLegacyInput = t.interface({
  message: NotifyMessage
});

export type NhNotifyMessageOrchestratorCallLegacyInput = t.TypeOf<
  typeof NhNotifyMessageOrchestratorCallLegacyInput
>;

export const handler = function*(
  context: IOrchestrationFunctionContext
): Generator<unknown> {
  const logPrefix = `NhNotifyMessageOrchestratorCallLegacyInput`;

  const retryOptions = {
    ...new df.RetryOptions(5000, 10),
    backoffCoefficient: 1.5
  };

  // Get and decode orchestrator input
  const input = context.df.getInput();
  const errorOrNHCallOrchestratorInput = NhNotifyMessageOrchestratorCallLegacyInput.decode(
    input
  );

  if (isLeft(errorOrNHCallOrchestratorInput)) {
    logError(context, logPrefix, errorOrNHCallOrchestratorInput);
    return false;
  }

  const nhCallOrchestratorInput = errorOrNHCallOrchestratorInput.value;

  yield context.df.callActivityWithRetry(
    NotifyMessageActivityName,
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
