/* tslint:disable: no-any */

import { some } from "fp-ts/lib/Option";
import { taskEither } from "fp-ts/lib/TaskEither";
import { context as contextMock } from "../../__mocks__/durable-functions_bck";
import { aRetrievedProfile } from "../../__mocks__/mocks";
import { StartEmailValidationProcessHandler } from "../handler";

describe("StartEmailValidationProcessHandler", () => {
  it("should start the orchestrator with the right input and return an acceppted response", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        taskEither.of(some({ ...aRetrievedProfile, isEmailValidated: false }))
      )
    };

    const handler = StartEmailValidationProcessHandler(profileModelMock as any);

    const result = await handler(
      contextMock as any,
      aRetrievedProfile.fiscalCode
    );

    expect(result.kind).toBe("IResponseSuccessAccepted");
  });

  it("should not start the orchestrator if the email is already validated", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        taskEither.of(some({ ...aRetrievedProfile, isEmailValidated: true }))
      )
    };

    const handler = StartEmailValidationProcessHandler(profileModelMock as any);

    await handler(contextMock as any, aRetrievedProfile.fiscalCode);
    const result = await handler(
      contextMock as any,
      aRetrievedProfile.fiscalCode
    );
    expect(result.kind).toBe("IResponseErrorValidation");
  });
});
