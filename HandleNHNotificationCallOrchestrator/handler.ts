import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import { IFunctionContext } from "durable-functions/lib/src/classes";

import * as df from "durable-functions";
import { readableReport } from "italia-ts-commons/lib/reporters";

import { NotificationHubMessage } from "../HandleNHNotificationCall";

/**
 * Carries information about Notification Hub Message payload
 */
export const OrchestratorInput = t.interface({
  message: NotificationHubMessage
});

export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

export const handler = function*(
  context: IFunctionContext
): IterableIterator<unknown> {
  const logPrefix = `NHCallOrchestrator`;

  const retryOptions = new df.RetryOptions(5000, 10);
  // tslint:disable-next-line: no-object-mutation
  retryOptions.backoffCoefficient = 1.5;

  // Get and decode orchestrator input
  const input = context.df.getInput();
  const errorOrNHCallOrchestratorInput = OrchestratorInput.decode(input);

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

  yield context.df.callActivity(
    "HandleNHNotificationCallActivity",
    nhCallOrchestratorInput
  );

  return true;
};
