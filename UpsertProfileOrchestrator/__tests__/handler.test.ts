/* tslint:disable:no-any */

import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aEmailChanged,
  aFiscalCode,
  aRetrievedProfile
} from "../../__mocks__/mocks";
import {
  OrchestratorInput as EmailVerificationProcessOrchestratorInput,
  OrchestratorResult as EmailVerificationProcessOrchestratorResult
} from "../../EmailVerificationProcessOrchestrator/handler";
import {
  handler,
  OrchestratorInput as UpsertProfileOrchestratorInput
} from "../handler";

describe("UpsertProfileOrchestrator", () => {
  it("should not start the EmailVerificationProcessOrchestrator if the email is not changed", () => {
    const upsertProfileOrchestratorInput = UpsertProfileOrchestratorInput.encode(
      {
        newProfile: { ...aRetrievedProfile, isWebhookEnabled: true },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }
    );

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callSubOrchestratorWithRetry: jest.fn(() => undefined),
        getInput: jest.fn(() => upsertProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).not.toBeCalled();
  });

  it("should start the activities with the right inputs", async () => {
    const upsertProfileOrchestratorInput = UpsertProfileOrchestratorInput.encode(
      {
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailVerificationProcessOrchestrator
          isInboxEnabled: true // Enable inbox to start the SendWelcomeMessagesActivity
        },
        oldProfile: { ...aRetrievedProfile, isInboxEnabled: false },
        updatedAt: new Date()
      }
    );

    const emailVerificationProcessOrchestratorResult = EmailVerificationProcessOrchestratorResult.encode(
      {
        kind: "SUCCESS"
      }
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivity: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: jest.fn(
          () => emailVerificationProcessOrchestratorResult
        ),
        getInput: jest.fn(() => upsertProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    const result = orchestratorHandler.next();

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      "EmailVerificationProcessOrchestrator",
      expect.anything(), // retryOptions
      EmailVerificationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode
      })
    );

    orchestratorHandler.next(result.value);

    expect(contextMockWithDf.df.callActivity).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      {
        profile: upsertProfileOrchestratorInput.newProfile
      }
    );
  });
});
