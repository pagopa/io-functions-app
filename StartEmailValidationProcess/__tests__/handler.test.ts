/* tslint:disable: no-any */

import { right } from "fp-ts/lib/Either";
import { some } from "fp-ts/lib/Option";

import * as df from "durable-functions";

import { context as contextMock } from "../../__mocks__/durable-functions";
import { aRetrievedProfile } from "../../__mocks__/mocks";
import { OrchestratorInput as EmailValidationProcessOrchestratorInput } from "../../EmailValidationProcessOrchestrator/handler";
import { StartEmailValidationProcessHandler } from "../handler";

beforeEach(() => {
  (df.getClient as any).mockClear();
  (df as any).mockStartNew.mockClear();
});

describe("StartEmailValidationProcessHandler", () => {
  it("should start the orchestrator with the right input and return an acceppted response", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() =>
        right(some({ ...aRetrievedProfile, isEmailValidated: false }))
      )
    };

    const handler = StartEmailValidationProcessHandler(profileModelMock as any);

    const result = await handler(
      contextMock as any,
      aRetrievedProfile.fiscalCode
    );

    const emailValidationProcessOrchestratorInput = EmailValidationProcessOrchestratorInput.encode(
      {
        email: aRetrievedProfile.email,
        fiscalCode: aRetrievedProfile.fiscalCode
      }
    );

    expect(df.getClient).toHaveBeenCalledTimes(1);

    const dfClient = df.getClient(contextMock);
    expect(dfClient.startNew).toHaveBeenCalledWith(
      "EmailValidationProcessOrchestrator",
      undefined,
      emailValidationProcessOrchestratorInput
    );

    expect(result.kind).toBe("IResponseSuccessAccepted");
  });

  it("should not start the orchestrator if the email is already validated", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() =>
        right(some({ ...aRetrievedProfile, isEmailValidated: true }))
      )
    };

    const handler = StartEmailValidationProcessHandler(profileModelMock as any);

    await handler(contextMock as any, aRetrievedProfile.fiscalCode);

    expect(df.getClient).not.toHaveBeenCalledTimes(1);
  });
});
