import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";

import * as df from "durable-functions";
import { readableReport } from "italia-ts-commons/lib/reporters";

import { NotificationMessage } from "../HandleNHNotificationCall";

/**
 * Carries information about Notification Hub Message payload
 */
export const NhNotificationOrchestratorInput = t.interface({
  message: NotificationMessage
});

export type NhNotificationOrchestratorInput = t.TypeOf<
  typeof NhNotificationOrchestratorInput
>;

export const handler = function*(
  context: IOrchestrationFunctionContext
): Generator<unknown> {
  context.log.info(
    `NHNotificationOrchestrator Started|Instance ID [${context.df.instanceId}]`
  );
  const logPrefix = `NHCallOrchestrator`;

  const retryOptions = new df.RetryOptions(5000, 10);
  // tslint:disable-next-line: no-object-mutation
  retryOptions.backoffCoefficient = 1.5;

  // Get and decode orchestrator input
  const input = context.df.getInput();
  const errorOrNHCallOrchestratorInput = NhNotificationOrchestratorInput.decode(
    input
  );

  if (isLeft(errorOrNHCallOrchestratorInput)) {
    context.log.error(`${logPrefix}|Error decoding input`);
    context.log.verbose(
      `${logPrefix}|Error decoding input|ERROR=${readableReport(
        errorOrNHCallOrchestratorInput.value
      )}`
    );
    return false;
  }

  const nhCallOrchestratorInput = errorOrNHCallOrchestratorInput.value;

  yield context.df.callActivityWithRetry(
    "HandleNHNotificationCallActivity",
    retryOptions,
    nhCallOrchestratorInput
  );

  return true;
};
