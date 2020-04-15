import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import * as df from "durable-functions";
import { IFunctionContext } from "durable-functions/lib/src/classes";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { UserDataProcessingChoice } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";

import { FiscalCode } from "io-functions-commons/dist/generated/definitions/FiscalCode";

/**
 * Carries information about created or updated user data processing.
 */
export const OrchestratorInput = t.interface({
  choice: UserDataProcessingChoice,
  fiscalCode: FiscalCode
});

export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

export const handler = function*(
  context: IFunctionContext
): IterableIterator<unknown> {
  const logPrefix = `UpsertedUserDataProcessingOrchestrator`;

  // Get and decode orchestrator input
  const input = context.df.getInput();
  const errorOrUpsertedUserDataProcessingOrchestratorInput = OrchestratorInput.decode(
    input
  );

  if (isLeft(errorOrUpsertedUserDataProcessingOrchestratorInput)) {
    context.log.error(`${logPrefix}|Error decoding input`);
    context.log.verbose(
      `${logPrefix}|Error decoding input|ERROR=${readableReport(
        errorOrUpsertedUserDataProcessingOrchestratorInput.value
      )}`
    );
    return false;
  }

  const upsertedUserDataProcessingOrchestratorInput =
    errorOrUpsertedUserDataProcessingOrchestratorInput.value;

  yield context.df.callActivity("SendUserDataProcessingEmailActivity", {
    upsertedUserDataProcessingOrchestratorInput
  });

  return true;
};
