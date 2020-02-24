/* tslint:disable:no-any */

import { right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aFiscalCode,
  aUserDataProcessing,
  aUserDataProcessingChoice,
  aUserDataProcessingId
} from "../../__mocks__/mocks";
import { GetUserDataProcessingHandler } from "../handler";

describe("GetUserDataProcessingHandler", () => {
  it("should find an existing User data processing", async () => {
    const userDataProcessingModelMock = {
      findOneUserDataProcessingById: jest.fn(() => {
        return Promise.resolve(right(some(aUserDataProcessing)));
      })
    };

    const getUserDataProcessingHandler = GetUserDataProcessingHandler(
      userDataProcessingModelMock as any
    );

    const response = await getUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode,
      aUserDataProcessingChoice
    );

    expect(
      userDataProcessingModelMock.findOneUserDataProcessingById
    ).toHaveBeenCalledWith(aFiscalCode, aUserDataProcessingId);
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aUserDataProcessing);
    }
  });

  it("should respond with NotFound if profile does not exist", async () => {
    const userDataProcessingModelMock = {
      findOneUserDataProcessingById: jest.fn(() => {
        return Promise.resolve(right(none));
      })
    };

    const getUserDataProcessingHandler = GetUserDataProcessingHandler(
      userDataProcessingModelMock as any
    );

    const response = await getUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode,
      aUserDataProcessingChoice
    );
    expect(
      userDataProcessingModelMock.findOneUserDataProcessingById
    ).toHaveBeenCalledWith(aFiscalCode, aUserDataProcessingId);
    expect(response.kind).toBe("IResponseErrorNotFound");
  });

  it("should reject the promise in case of errors", () => {
    const userDataProcessingModelMock = {
      findOneUserDataProcessingById: jest.fn(() => {
        return Promise.reject("error");
      })
    };

    const getUserDataProcessingHandler = GetUserDataProcessingHandler(
      userDataProcessingModelMock as any
    );

    const promise = getUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode,
      aUserDataProcessingChoice
    );

    return expect(promise).rejects.toBe("error");
  });
});
