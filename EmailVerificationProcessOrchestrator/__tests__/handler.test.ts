/* tslint:disable:no-any */

import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aEmail,
  aFiscalCode,
  aTokenId,
  aValidator,
  aValidatorHash
} from "../../__mocks__/mocks";
import {
  ActivityInput as CreateVerificationTokenActivityInput,
  ActivityResult as CreateVerificationTokenActivityResult
} from "../../CreateVerificationTokenActivity/handler";
import {
  ActivityInput as SendVerificationEmailActivityInput,
  ActivityResult as SendVerificationEmailActivityResult
} from "../../SendVerificationEmailActivity/handler";
import {
  handler,
  OrchestratorInput as EmailVerificationProcessOrchestratorInput
} from "../handler";

describe("EmailVerificationProcessOrchestrator", () => {
  it("should start the activities with the right inputs", async () => {
    const emailVerificationProcessOrchestratorInput = EmailVerificationProcessOrchestratorInput.encode(
      {
        email: aEmail,
        fiscalCode: aFiscalCode
      }
    );

    const createVerificationTokenActivityResult = CreateVerificationTokenActivityResult.encode(
      {
        kind: "SUCCESS",
        value: {
          validator: aValidator,
          verificationTokenEntity: {
            FiscalCode: aFiscalCode,
            InvalidAfter: new Date(),
            PartitionKey: aTokenId,
            RowKey: aValidatorHash
          }
        }
      }
    );

    const sendVerificationEmailActivityResult = SendVerificationEmailActivityResult.encode(
      {
        kind: "SUCCESS"
      }
    );

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(createVerificationTokenActivityResult)
          .mockReturnValueOnce(sendVerificationEmailActivityResult),
        getInput: jest.fn(() => emailVerificationProcessOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    const result = orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "CreateVerificationTokenActivity",
      expect.anything(), // retryOptions
      CreateVerificationTokenActivityInput.encode({
        fiscalCode: aFiscalCode
      })
    );

    orchestratorHandler.next(result.value);

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendVerificationEmailActivity",
      expect.anything(), // retryOptions
      SendVerificationEmailActivityInput.encode({
        email: aEmail,
        token: `${aTokenId}:${aValidator}`
      })
    );
  });
});
