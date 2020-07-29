/* tslint:disable: no-any */

import * as lolex from "lolex";

import * as df from "durable-functions";

import { none, some } from "fp-ts/lib/Option";
import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aClosedRetrievedUserDataProcessing,
  aFiscalCode,
  aRetrievedUserDataProcessing,
  aUserDataProcessingApi,
  aUserDataProcessingChoiceRequest,
  aWipRetrievedUserDataProcessing
} from "../../__mocks__/mocks";
import { UpsertUserDataProcessingHandler } from "../handler";

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

describe("UpsertUserDataProcessingHandler", () => {
  it("should return a query error when an error occurs creating the new User data processing", async () => {
    const userDataProcessingModelMock = {
      findLastVersionByModelId: jest.fn(() => taskEither.of(none)),
      upsert: jest.fn(() => fromLeft({}))
    };

    const upsertUserDataProcessingHandler = UpsertUserDataProcessingHandler(
      userDataProcessingModelMock as any
    );

    const result = await upsertUserDataProcessingHandler(
      contextMock as any,
      undefined as any,
      {} as any
    );

    expect(result.kind).toBe("IResponseErrorQuery");
  });

  it("should return a conflict error when a new request is upserted and it was already PENDING", async () => {
    const userDataProcessingModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        taskEither.of(some(aRetrievedUserDataProcessing))
      )
    };

    const upsertUserDataProcessingHandler = UpsertUserDataProcessingHandler(
      userDataProcessingModelMock as any
    );

    const result = await upsertUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode,
      aUserDataProcessingChoiceRequest
    );

    expect(result.kind).toBe("IResponseErrorConflict");
  });

  it("should return a conflict error when a new request is upserted and it was already WIP", async () => {
    const userDataProcessingModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        taskEither.of(some(aWipRetrievedUserDataProcessing))
      )
    };

    const upsertUserDataProcessingHandler = UpsertUserDataProcessingHandler(
      userDataProcessingModelMock as any
    );

    const result = await upsertUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode,
      aUserDataProcessingChoiceRequest
    );

    expect(result.kind).toBe("IResponseErrorConflict");
  });

  it("should return the upserted user data processing in case the request was CLOSED", async () => {
    const userDataProcessingModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        taskEither.of(some(aClosedRetrievedUserDataProcessing))
      ),
      upsert: jest.fn(() => taskEither.of(aRetrievedUserDataProcessing))
    };
    const upsertUserDataProcessingHandler = UpsertUserDataProcessingHandler(
      userDataProcessingModelMock as any
    );

    const result = await upsertUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode,
      aUserDataProcessingChoiceRequest
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aUserDataProcessingApi);
    }
  });

  it("should return the upserted user data processing in case there was no preceeding request", async () => {
    const userDataProcessingModelMock = {
      findLastVersionByModelId: jest.fn(() => taskEither.of(none)),
      upsert: jest.fn(() => taskEither.of(aRetrievedUserDataProcessing))
    };
    const upsertUserDataProcessingHandler = UpsertUserDataProcessingHandler(
      userDataProcessingModelMock as any
    );

    const result = await upsertUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode,
      aUserDataProcessingChoiceRequest
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aUserDataProcessingApi);
    }
  });
});
