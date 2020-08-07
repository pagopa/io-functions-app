/* tslint:disable:no-any */

import { none, some } from "fp-ts/lib/Option";

import { fromLeft } from "fp-ts/lib/IOEither";
import { taskEither } from "fp-ts/lib/TaskEither";
import {
  aExtendedProfile,
  aFiscalCode,
  aRetrievedProfile
} from "../../__mocks__/mocks";
import { GetProfileHandler } from "../handler";

describe("GetProfileHandler", () => {
  it("should find an existing profile", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.of(some(aRetrievedProfile));
      })
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const response = await getProfileHandler(aFiscalCode);

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalledWith([
      aFiscalCode
    ]);
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aExtendedProfile);
    }
  });

  it("should respond with NotFound if profile does not exist", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.of(none);
      })
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const response = await getProfileHandler(aFiscalCode);
    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalledWith([
      aFiscalCode
    ]);
    expect(response.kind).toBe("IResponseErrorNotFound");
  });

  it("should reject the promise in case of errors", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return fromLeft("error");
      })
    };

    const getProfileHandler = GetProfileHandler(profileModelMock as any);

    const result = await getProfileHandler(aFiscalCode);

    expect(result.kind).toBe("IResponseErrorQuery");
  });
});
