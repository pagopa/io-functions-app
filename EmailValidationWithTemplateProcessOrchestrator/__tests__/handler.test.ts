/* eslint-disable @typescript-eslint/no-explicit-any */

import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aEmail,
  aFiscalCode,
  aName,
  aTokenId,
  aValidator,
  aValidatorHash
} from "../../__mocks__/mocks";
import {
  ActivityInput as CreateValidationTokenActivityInput,
  ActivityResult as CreateValidationTokenActivityResult
} from "../../CreateValidationTokenActivity/handler";
import {
  ActivityInput as SendValidationEmailActivityInput,
  ActivityResult as SendValidationEmailActivityResult
} from "../../SendTemplatedValidationEmailActivity/handler";
import {
  handler,
  OrchestratorInput as EmailValidationProcessOrchestratorInput
} from "../handler";

describe("EmailValidationWithTemaplteProcessOrchestrator", () => {
  it("should start the activities with the right inputs", async () => {
    const emailValidationProcessOrchestratorInput = EmailValidationProcessOrchestratorInput.encode(
      {
        email: aEmail,
        fiscalCode: aFiscalCode,
        name: aName
      }
    );

    const createValidationTokenActivityResult = CreateValidationTokenActivityResult.encode(
      {
        kind: "SUCCESS",
        value: {
          validationTokenEntity: {
            Email: aEmail,
            FiscalCode: aFiscalCode,
            InvalidAfter: new Date(),
            PartitionKey: aTokenId,
            RowKey: aValidatorHash
          },
          validator: aValidator
        }
      }
    );

    const sendValidationEmailActivityResult = SendValidationEmailActivityResult.encode(
      {
        kind: "SUCCESS"
      }
    );

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(createValidationTokenActivityResult)
          .mockReturnValueOnce(sendValidationEmailActivityResult),
        getInput: jest.fn(() => emailValidationProcessOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    const result = orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "CreateValidationTokenActivity",
      expect.anything(), // retryOptions
      CreateValidationTokenActivityInput.encode({
        email: aEmail,
        fiscalCode: aFiscalCode
      })
    );

    orchestratorHandler.next(result.value);

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendTemplatedValidationEmailActivity",
      expect.anything(), // retryOptions
      SendValidationEmailActivityInput.encode({
        email: aEmail,
        token: `${aTokenId}:${aValidator}`,
        name: aName
      })
    );
  });
});
