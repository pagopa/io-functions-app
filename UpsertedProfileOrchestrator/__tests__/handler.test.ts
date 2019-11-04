/* tslint:disable:no-any */

import { context as contextMock } from "../../__mocks__/durable-functions";
import { aRetrievedProfile } from "../../__mocks__/mocks";
import {
  handler,
  OrchestratorInput as UpsertedProfileOrchestratorInput
} from "../handler";

describe("UpsertedProfileOrchestrator", () => {
  it("should start the activities with the right inputs", async () => {
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.encode(
      {
        newProfile: {
          ...aRetrievedProfile,
          isInboxEnabled: true // Enable inbox to start the SendWelcomeMessagesActivity
        },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivity: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivity).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      {
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );
  });
});
