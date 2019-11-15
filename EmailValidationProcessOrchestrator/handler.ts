import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import * as df from "durable-functions";
import { IFunctionContext } from "durable-functions/lib/src/classes";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { EmailString, FiscalCode } from "italia-ts-commons/lib/strings";

import {
  ActivityInput as CreateValidationTokenActivityInput,
  ActivityResult as CreateValidationTokenActivityResult
} from "../CreateValidationTokenActivity/handler";
import {
  ActivityInput as SendValidationEmailActivityInput,
  ActivityResult as SendValidationEmailActivityResult
} from "../SendValidationEmailActivity/handler";

// Input
export const OrchestratorInput = t.interface({
  email: EmailString,
  fiscalCode: FiscalCode
});

export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

// Result
export const OrchestratorSuccessResult = t.interface({
  kind: t.literal("SUCCESS")
});

export const OrchestratorFailureResult = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

export const OrchestratorResult = t.taggedUnion("kind", [
  OrchestratorSuccessResult,
  OrchestratorFailureResult
]);

export type OrchestratorResult = t.TypeOf<typeof OrchestratorResult>;

/**
 * An orchestrator to handle the email validation process.
 */
export const handler = function*(
  context: IFunctionContext
): IterableIterator<unknown> {
  const logPrefix = `EmailValidationProcessOrchestrator`;

  const retryOptions = new df.RetryOptions(5000, 10);
  // tslint:disable-next-line: no-object-mutation
  retryOptions.backoffCoefficient = 1.5;

  context.log.verbose(`${logPrefix}|Email validation process started`);

  // Decode the input
  const input = context.df.getInput();
  const errorOrOrchestratorInput = OrchestratorInput.decode(input);
  if (isLeft(errorOrOrchestratorInput)) {
    const error = Error(
      `${logPrefix}|Error decoding input|ERROR=${readableReport(
        errorOrOrchestratorInput.value
      )}`
    );
    context.log.error(error.message);
    return OrchestratorFailureResult.encode({
      kind: "FAILURE",
      reason: error.message
    });
    // We don't throw an error because we can't do a retry in this scenario
  }

  const orchestratorInput = errorOrOrchestratorInput.value;
  const { fiscalCode, email } = orchestratorInput;

  // Log the input
  context.log.verbose(
    `${logPrefix}|INPUT=${JSON.stringify(orchestratorInput)}`
  );

  try {
    // STEP 1: Create new validation token
    context.log.verbose(`${logPrefix}|Starting CreateValidationTokenActivity`);

    // Prepare the input
    const createValidationTokenActivityInput = CreateValidationTokenActivityInput.encode(
      {
        email,
        fiscalCode
      }
    );

    // Start the activity
    const createValidationTokenActivityResultJson = yield context.df.callActivityWithRetry(
      "CreateValidationTokenActivity",
      retryOptions,
      createValidationTokenActivityInput
    );

    // Decode the activity result
    const errorOrCreateValidationTokenActivityResult = CreateValidationTokenActivityResult.decode(
      createValidationTokenActivityResultJson
    );

    if (isLeft(errorOrCreateValidationTokenActivityResult)) {
      const error = Error(
        `${logPrefix}|Error decoding activity result|ERROR=${readableReport(
          errorOrCreateValidationTokenActivityResult.value
        )}`
      );
      context.log.error(error.message);
      // Throw an error so the whole process is retried
      throw error;
    }

    const createValidationTokenActivityResult =
      errorOrCreateValidationTokenActivityResult.value;

    if (createValidationTokenActivityResult.kind === "FAILURE") {
      const error = Error(
        `${logPrefix}|Activity error|ERROR=${createValidationTokenActivityResult.reason}`
      );
      context.log.error(error.message);
      // Throw an error so the whole process is retried
      throw error;
    }

    const {
      validator,
      validationTokenEntity
    } = createValidationTokenActivityResult.value;
    context.log.verbose(
      `${logPrefix}|ValidationToken created successfully|TOKEN_ID=${validationTokenEntity.PartitionKey}|TOKEN_VALIDATOR=${validator}`
    );

    // STEP 2: Send an email with the validation link
    context.log.verbose(`${logPrefix}|Starting SendValidationEmailActivity`);

    // Prepare the input
    const sendValidationEmailActivityInput = SendValidationEmailActivityInput.encode(
      {
        email,
        token: `${validationTokenEntity.PartitionKey}:${validator}`
      }
    );

    // Start the activity
    const sendValidationEmailActivityResultJson = yield context.df.callActivityWithRetry(
      "SendValidationEmailActivity",
      retryOptions,
      sendValidationEmailActivityInput
    );

    // Decode the activity result
    const errorOrSendValidationEmailActivityResult = SendValidationEmailActivityResult.decode(
      sendValidationEmailActivityResultJson
    );

    if (isLeft(errorOrSendValidationEmailActivityResult)) {
      const error = Error(
        `${logPrefix}|Error decoding activity result|ERROR=${readableReport(
          errorOrSendValidationEmailActivityResult.value
        )}`
      );
      context.log.error(error.message);
      // Throw an error so the whole process is retried
      throw error;
    }

    const sendValidationEmailActivityResult =
      errorOrSendValidationEmailActivityResult.value;

    if (sendValidationEmailActivityResult.kind === "FAILURE") {
      const error = Error(
        `${logPrefix}|Activity error|ERROR=${sendValidationEmailActivityResult.reason}`
      );
      context.log.error(error.message);
      // Throw an error so the whole process is retried
      throw error;
    }

    context.log.verbose(`${logPrefix}|Validation email sent successfully`);

    return OrchestratorSuccessResult.encode({
      kind: "SUCCESS"
    });
  } catch (e) {
    const error = Error(`${logPrefix}|Max retry exceeded|ERROR=${e}`);
    context.log.error(error.message);
    // Throw an error so the whole process is retried
    throw error;
  }
};
