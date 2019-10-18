/* tslint:disable: no-any */

import { right } from "fp-ts/lib/Either";
import { some } from "fp-ts/lib/Option";

import * as df from "durable-functions";

import { context as contextMock } from "../../__mocks__/durable-functions";
import { aRetrievedProfile } from "../../__mocks__/mocks";
import { OrchestratorInput as EmailVerificationProcessOrchestratorInput } from "../../EmailVerificationProcessOrchestrator/handler";
import { StartEmailVerificationProcessHandler } from "../handler";

beforeEach(() => {
  (df.getClient as any).mockClear();
  (df as any).mockStartNew.mockClear();
});

describe("StartEmailVerificationProcessHandler", () => {
  it("should start the orchestrator with the right input and return an acceppted response", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => right(some(aRetrievedProfile)))
    };

    const handler = StartEmailVerificationProcessHandler(
      profileModelMock as any
    );

    const result = await handler(
      contextMock as any,
      aRetrievedProfile.fiscalCode
    );

    const emailVerificationProcessOrchestratorInput = EmailVerificationProcessOrchestratorInput.encode(
      {
        email: aRetrievedProfile.email,
        fiscalCode: aRetrievedProfile.fiscalCode
      }
    );

    expect(df.getClient).toHaveBeenCalledTimes(1);

    const dfClient = df.getClient(contextMock);
    expect(dfClient.startNew).toHaveBeenCalledWith(
      "EmailVerificationProcessOrchestrator",
      undefined,
      emailVerificationProcessOrchestratorInput
    );

    expect(result.kind).toBe("IResponseSuccessAccepted");
  });
});
