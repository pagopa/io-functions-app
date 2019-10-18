import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import * as df from "durable-functions";
import { IFunctionContext } from "durable-functions/lib/src/classes";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { EmailString, FiscalCode } from "italia-ts-commons/lib/strings";

import {
  ActivityInput as CreateVerificationTokenActivityInput,
  ActivityResult as CreateVerificationTokenActivityResult
} from "../CreateVerificationTokenActivity/handler";
import {
  ActivityInput as SendVerificationEmailActivityInput,
  ActivityResult as SendVerificationEmailActivityResult
} from "../SendVerificationEmailActivity/handler";

export const OrchestratorInput = t.interface({
  email: EmailString,
  fiscalCode: FiscalCode
});

export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

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
 * An orchestrator to handle the email verification process.
 */
export const handler = function*(
  context: IFunctionContext
): IterableIterator<unknown> {
  const logPrefix = `EmailVerificationProcessOrchestrator`;

  const retryOptions = new df.RetryOptions(5000, 10);
  // tslint:disable-next-line: no-object-mutation
  retryOptions.backoffCoefficient = 1.5;

  context.log.verbose(`${logPrefix}|Email verification process started`);

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

  try {
    // STEP 1: Create new verification token

    // Prepare the input
    const createVerificationTokenActivityInput = CreateVerificationTokenActivityInput.encode(
      {
        fiscalCode
      }
    );

    // Start the activity
    const createVerificationTokenActivityResultJson = yield context.df.callActivityWithRetry(
      "CreateVerificationTokenActivity",
      retryOptions,
      createVerificationTokenActivityInput
    );

    // Decode the activity result
    const errorOrCreateVerificationTokenActivityResult = CreateVerificationTokenActivityResult.decode(
      createVerificationTokenActivityResultJson
    );

    if (isLeft(errorOrCreateVerificationTokenActivityResult)) {
      const error = Error(
        `${logPrefix}|Error decoding activity result|ERROR=${readableReport(
          errorOrCreateVerificationTokenActivityResult.value
        )}`
      );
      context.log.error(error.message);
      // Throw an error so the whole process is retried
      throw error;
    }

    const createVerificationTokenActivityResult =
      errorOrCreateVerificationTokenActivityResult.value;

    if (createVerificationTokenActivityResult.kind === "FAILURE") {
      const error = Error(
        `${logPrefix}|Activity error|ERROR=${createVerificationTokenActivityResult.reason}`
      );
      context.log.error(error.message);
      // Throw an error so the whole process is retried
      throw error;
    }

    const {
      validator,
      verificationTokenEntity
    } = createVerificationTokenActivityResult.value;
    context.log.verbose(
      `${logPrefix}|VerificationToken created successfully|TOKEN_ID=${verificationTokenEntity.PartitionKey}|TOKEN_VALIDATOR=${validator}`
    );

    // STEP 2: Send an email withe the verification link

    // Prepare the input
    const sendVerificationEmailActivityInput = SendVerificationEmailActivityInput.encode(
      {
        email,
        token: `${verificationTokenEntity.PartitionKey}:${validator}`
      }
    );

    // Start the activity
    const sendVerificationEmailActivityResultJson = yield context.df.callActivityWithRetry(
      "SendVerificationEmailActivity",
      retryOptions,
      sendVerificationEmailActivityInput
    );

    // Decode the activity result
    const errorOrSendVerificationEmailActivityResult = SendVerificationEmailActivityResult.decode(
      sendVerificationEmailActivityResultJson
    );

    if (isLeft(errorOrSendVerificationEmailActivityResult)) {
      const error = Error(
        `${logPrefix}|Error decoding activity result|ERROR=${readableReport(
          errorOrSendVerificationEmailActivityResult.value
        )}`
      );
      context.log.error(error.message);
      // Throw an error so the whole process is retried
      throw error;
    }

    const sendVerificationEmailActivityResult =
      errorOrSendVerificationEmailActivityResult.value;

    if (sendVerificationEmailActivityResult.kind === "FAILURE") {
      const error = Error(
        `${logPrefix}|Activity error|ERROR=${sendVerificationEmailActivityResult.reason}`
      );
      context.log.error(error.message);
      // Throw an error so the whole process is retried
      throw error;
    }

    context.log.verbose(`${logPrefix}|Verification email sent successfully`);

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
