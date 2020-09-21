/* tslint:disable:no-any */

import * as df from "durable-functions";
import { readableReport } from "italia-ts-commons/lib/reporters";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aEmailChanged,
  aFiscalCode,
  aRetrievedProfile
} from "../../__mocks__/mocks";
import {
  OrchestratorInput as EmailValidationProcessOrchestratorInput,
  OrchestratorResult as EmailValidationProcessOrchestratorResult
} from "../../EmailValidationProcessOrchestrator/handler";
import {
  handler,
  OrchestratorInput as UpsertedProfileOrchestratorInput
} from "../handler";

const someRetryOptions = new df.RetryOptions(5000, 10);
// tslint:disable-next-line: no-object-mutation
someRetryOptions.backoffCoefficient = 1.5;

describe("UpsertedProfileOrchestrator", () => {
  it("should not start the EmailValidationProcessOrchestrator if the email is not changed", () => {
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.decode(
      {
        newProfile: { ...aRetrievedProfile, isWebhookEnabled: true },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }
    ).getOrElseL(_ =>
      fail(
        `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(_)}`
      )
    );

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callSubOrchestratorWithRetry: jest.fn(() => undefined),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).not.toBeCalled();
  });

  it("should start the activities with the right inputs", async () => {
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.decode(
      {
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true // Enable inbox to start the SendWelcomeMessagesActivity
        },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }
    ).getOrElseL(_ =>
      fail(
        `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(_)}`
      )
    );

    const emailValidationProcessOrchestratorResult = EmailValidationProcessOrchestratorResult.decode(
      {
        kind: "SUCCESS"
      }
    ).getOrElseL(_ =>
      fail(
        `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
          _
        )}`
      )
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: jest.fn(
          () => emailValidationProcessOrchestratorResult
        ),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    const result = orchestratorHandler.next();

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      "EmailValidationProcessOrchestrator",
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode
      })
    );

    orchestratorHandler.next(result.value);
    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    orchestratorHandler.next();
    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );
  });
});
