/* tslint:disable: no-any */

import * as lolex from "lolex";

import { left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";

import * as df from "durable-functions";

import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aEmailChanged,
  aExtendedProfile,
  aFiscalCode,
  aProfile,
  aRetrievedProfile
} from "../../__mocks__/mocks";
import { OrchestratorInput as UpsertProfileOrchestratorInput } from "../../UpsertProfileOrchestrator/handler";
import { UpdateProfileHandler } from "../handler";

// tslint:disable-next-line: no-let
let clock: any;
beforeEach(() => {
  (df.getClient as any).mockClear();
  (df as any).mockStartNew.mockClear();
  // We need to mock time to test token expiration.
  clock = lolex.install({ now: Date.now() });
});
afterEach(() => {
  clock = clock.uninstall();
});

describe("UpdateProfileHandler", () => {
  it("should return a query error when an error occurs retrieving the existing profile", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => left({}))
    };

    const updateProfileHandler = UpdateProfileHandler(profileModelMock as any);

    const result = await updateProfileHandler(
      contextMock as any,
      undefined as any,
      {} as any
    );

    expect(result.kind).toBe("IResponseErrorQuery");
  });

  it("should return a not found error if can't find an existing profile", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => right(none))
    };

    const updateProfileHandler = UpdateProfileHandler(profileModelMock as any);

    const result = await updateProfileHandler(
      contextMock as any,
      undefined as any,
      {} as any
    );

    expect(result.kind).toBe("IResponseErrorNotFound");
  });

  it("should return a conflict error if the verion in the payload is not the latest", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => right(some(aRetrievedProfile)))
    };

    const updateProfileHandler = UpdateProfileHandler(profileModelMock as any);

    const result = await updateProfileHandler(
      contextMock as any,
      undefined as any,
      {
        version: 1
      } as any
    );

    expect(result.kind).toBe("IResponseErrorConflict");
  });

  it("should set isEmailValidated to false if the email is changed", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() =>
        // Return a profile with a validated email
        right(some({ ...aRetrievedProfile, isEmailValidated: true }))
      ),
      update: jest.fn((_, __, f) => {
        const updatedProfile = f(aRetrievedProfile);
        return Promise.resolve(right(some(updatedProfile)));
      })
    };

    const updateProfileHandler = UpdateProfileHandler(profileModelMock as any);

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      email: aEmailChanged
    });

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual({
        ...aExtendedProfile,
        email: aEmailChanged,
        // The email is no more validated
        is_email_validated: false
      });
    }
  });

  it("should start the orchestrator with the appropriate input after the profile has been created", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => right(some(aRetrievedProfile))),
      update: jest.fn((_, __, f) => {
        const updatedProfile = f(aRetrievedProfile);
        return Promise.resolve(right(some(updatedProfile)));
      })
    };

    const updateProfileHandler = UpdateProfileHandler(profileModelMock as any);

    await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      email: aEmailChanged
    });

    const upsertProfileOrchestratorInput = UpsertProfileOrchestratorInput.encode(
      {
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged,
          isEmailValidated: false
        },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }
    );

    expect(df.getClient).toHaveBeenCalledTimes(1);

    const dfClient = df.getClient(contextMock);
    expect(dfClient.startNew).toHaveBeenCalledWith(
      "UpsertProfileOrchestrator",
      undefined,
      upsertProfileOrchestratorInput
    );
  });
});
