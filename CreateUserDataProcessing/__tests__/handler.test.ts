/* tslint:disable: no-any */

import * as lolex from "lolex";

import { left, right } from "fp-ts/lib/Either";

import * as df from "durable-functions";

import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aFiscalCode,
  aUserDataProcessing,
  aUserDataProcessingChoice,
  aUserDataProcessingStatus
} from "../../__mocks__/mocks";
import { CreateUserDataProcessingHandler } from "../handler";

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

describe("CreateUserDataProcessingHandler", () => {
  it("should return a query error when an error occurs creating the new User data processing", async () => {
    const userDataProcessingModelMock = {
      createOrUpdateByNewOne: jest.fn(() => left({}))
    };

    const createUserDataProcessingHandler = CreateUserDataProcessingHandler(
      userDataProcessingModelMock as any
    );

    const result = await createUserDataProcessingHandler(
      contextMock as any,
      undefined as any,
      {} as any
    );

    expect(result.kind).toBe("IResponseErrorQuery");
  });

  it("should return the created user data processing", async () => {
    const userDataProcessingModelMock = {
      createOrUpdateByNewOne: jest.fn(() => right(aUserDataProcessing))
    };

    const createUserDataProcessingHandler = CreateUserDataProcessingHandler(
      userDataProcessingModelMock as any
    );

    const result = await createUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode,
      aUserDataProcessingChoice
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(aUserDataProcessing);
    }
  });
});
