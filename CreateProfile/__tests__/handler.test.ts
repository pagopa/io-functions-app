/* tslint:disable: no-any */

import * as lolex from "lolex";

import { left, right } from "fp-ts/lib/Either";

import * as df from "durable-functions";

import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aExtendedProfile,
  aFiscalCode,
  aNewProfile,
  aRetrievedProfile,
  aProfile
} from "../../__mocks__/mocks";
import { OrchestratorInput as UpsertedProfileOrchestratorInput } from "../../UpsertedProfileOrchestrator/handler";
import { CreateProfileHandler } from "../handler";

// tslint:disable-next-line: no-let
let clock: any;
beforeEach(() => {
  (df.getClient as any).mockClear();
  (df as any).mockStartNew.mockClear();
  clock = lolex.install({ now: Date.now() });
});
afterEach(() => {
  clock = clock.uninstall();
});

describe("CreateProfileHandler", () => {
  it("should return a query error when an error occurs creating the new profile", async () => {
    const profileModelMock = {
      create: jest.fn(() => fromLeft({}))
    };

    const createProfileHandler = CreateProfileHandler(profileModelMock as any);

    const result = await createProfileHandler(
      contextMock as any,
      undefined as any,
      {} as any
    );

    expect(result.kind).toBe("IResponseErrorQuery");
  });

  it("should return the created profile", async () => {
    const profileModelMock = {
      create: jest.fn(() => taskEither.of(aRetrievedProfile))
    };

    const createProfileHandler = CreateProfileHandler(profileModelMock as any);

    const result = await createProfileHandler(
      contextMock as any,
      aFiscalCode,
      aNewProfile
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aExtendedProfile);
    }
  });

  it("should start the orchestrator with the appropriate input after the profile has been created", async () => {
    const profileModelMock = {
      create: jest.fn(() => taskEither.of(aRetrievedProfile))
    };
    const createProfileHandler = CreateProfileHandler(profileModelMock as any);

    await createProfileHandler(contextMock as any, aFiscalCode, {} as any);

    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.encode(
      {
        newProfile: aRetrievedProfile,
        updatedAt: new Date()
      }
    );

    expect(df.getClient).toHaveBeenCalledTimes(1);

    const dfClient = df.getClient(contextMock);
    expect(dfClient.startNew).toHaveBeenCalledWith(
      "UpsertedProfileOrchestrator",
      undefined,
      upsertedProfileOrchestratorInput
    );
  });
});
