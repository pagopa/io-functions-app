/* tslint:disable: no-any */

import * as lolex from "lolex";

import { left, right } from "fp-ts/lib/Either";

import * as df from "durable-functions";

import { none, some } from "fp-ts/lib/Option";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aFiscalCode,
  aRetrievedUserDataProcessing,
  aUserDataProcessingApi,
  aUserDataProcessingChoiceRequest,
  aWipRetrievedUserDataProcessing,
  aWipUserDataProcessingApi
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
      createOrUpdateByNewOne: jest.fn(() => left({})),
      findOneUserDataProcessingById: jest.fn(() =>
        right(some(aWipRetrievedUserDataProcessing))
      )
    };

    const upsertUserDataProcessingHandler = UpsertUserDataProcessingHandler(
      userDataProcessingModelMock as any
    );

    const result = await upsertUserDataProcessingHandler(
      contextMock as any,
      undefined as any,
      {} as any
    );

    expect(result.kind).toBe("IResponseErrorValidation");
  });

  it("should return the upserted user data processing with status equal to WIP", async () => {
    const userDataProcessingModelMock = {
      createOrUpdateByNewOne: jest.fn(() =>
        right(aWipRetrievedUserDataProcessing)
      ),
      findOneUserDataProcessingById: jest.fn(() =>
        right(some(aWipRetrievedUserDataProcessing))
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

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aWipUserDataProcessingApi);
    }
  });

  it("should return the upserted user data processing", async () => {
    const userDataProcessingModelMock = {
      createOrUpdateByNewOne: jest.fn(() =>
        right(aRetrievedUserDataProcessing)
      ),
      findOneUserDataProcessingById: jest.fn(() =>
        right(some(aRetrievedUserDataProcessing))
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

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aUserDataProcessingApi);
    }
  });
});
