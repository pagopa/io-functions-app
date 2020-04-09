/* tslint:disable:no-any */

import { context as contextMock } from "../../__mocks__/durable-functions";
import { aFiscalCode, aUserDataProcessingChoice } from "../../__mocks__/mocks";

import { UserDataProcessingChoice } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import {
  ActivityInput as SendUserDataProcessingEmailActivityInput,
  ActivityResult
} from "../../SendUserDataProcessingEmailActivity/handler";
import {
  handler,
  OrchestratorInput as UpsertedUserDataProcessingOrchestratorInput
} from "../handler";

describe("UpsertedUserDataProcessingOrchestrator", () => {
  it("should start the activities with the right inputs", async () => {
    const upsertedUserDataProcessingOrchestratorInput = UpsertedUserDataProcessingOrchestratorInput.encode(
      {
        choice: "DOWNLOAD" as UserDataProcessingChoice,
        fiscalCode: aFiscalCode
      }
    );

    const sendUserDataProcessingEmailActivityResult = ActivityResult.encode({
      kind: "SUCCESS"
    });

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivity: jest
          .fn()
          .mockReturnValueOnce(sendUserDataProcessingEmailActivityResult),
        getInput: jest.fn(() => upsertedUserDataProcessingOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivity).toBeCalledWith(
      "SendUserDataProcessingEmailActivity",
      SendUserDataProcessingEmailActivityInput.encode({
        choice: aUserDataProcessingChoice,
        fiscalCode: aFiscalCode
      })
    );
  });
});
