/* eslint-disable @typescript-eslint/no-explicit-any */

import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aEmail,
  aFiscalCode,
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
} from "../../SendValidationEmailActivity/handler";
import {
  getHandler,
  OrchestratorInput as EmailValidationProcessOrchestratorInput
} from "../handler";
import { FeatureFlagEnum } from "../../utils/featureFlag";

describe("EmailValidationProcessOrchestrator", () => {
  it.each([
    {
      betaList: [],
      ff: FeatureFlagEnum.NONE,
      expectedEamilValidationActivity: "SendValidationEmailActivity"
    },
    {
      betaList: [aFiscalCode],
      ff: FeatureFlagEnum.NONE,
      expectedEamilValidationActivity: "SendValidationEmailActivity"
    },
    {
      betaList: [aFiscalCode],
      ff: FeatureFlagEnum.BETA,
      expectedEamilValidationActivity: "SendTemplatedValidationEmailActivity"
    },
    {
      betaList: [],
      ff: FeatureFlagEnum.ALL,
      expectedEamilValidationActivity: "SendTemplatedValidationEmailActivity"
    }
  ])(
    "GIVEN an orchestrator with FF: $ff and beta_list: $betaList WHEN the orchestrator start THEN should start the activities with the right inputs",
    async ({ betaList, ff, expectedEamilValidationActivity }) => {
      const emailValidationProcessOrchestratorInput = EmailValidationProcessOrchestratorInput.encode(
        {
          email: aEmail,
          fiscalCode: aFiscalCode
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

      const orchestratorHandler = getHandler({
        BETA_USERS: betaList,
        FF_TEMPLATE_EMAIL: ff
      })(contextMockWithDf as any);

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
        expectedEamilValidationActivity,
        expect.anything(), // retryOptions
        SendValidationEmailActivityInput.encode({
          email: aEmail,
          token: `${aTokenId}:${aValidator}`
        })
      );
    }
  );
});
