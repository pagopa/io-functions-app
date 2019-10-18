/* tslint:disable:no-any */

import { right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";

import {
  aExtendedProfile,
  aFiscalCode,
  aRetrievedProfile
} from "../../__mocks__/mocks";
import { GetProfileHandler } from "../handler";

describe("GetProfileHandler", () => {
  it("should find an existing profile", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfile)));
      })
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const response = await getProfileHandler(aFiscalCode);

    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aFiscalCode
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aExtendedProfile);
    }
  });

  it("should respond with NotFound if profile does not exist", async () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(none));
      })
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const response = await getProfileHandler(aFiscalCode);
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aFiscalCode
    );
    expect(response.kind).toBe("IResponseErrorNotFound");
  });

  it("should reject the promise in case of errors", () => {
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.reject("error");
      })
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const promise = getProfileHandler(aFiscalCode);

    return expect(promise).rejects.toBe("error");
  });
});
