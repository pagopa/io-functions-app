/* tslint:disable:no-any */

import { none, some } from "fp-ts/lib/Option";

import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import { fromLeft } from "fp-ts/lib/IOEither";
import { taskEither } from "fp-ts/lib/TaskEither";
import {
  aExtendedProfile,
  aFiscalCode,
  aRetrievedProfile
} from "../../__mocks__/mocks";
import { GetProfileHandler } from "../handler";

const anEmailModeSwitchLimitDate = UTCISODateFromString.decode(
  "2021-07-08T23:59:59Z"
).getOrElseL(() => fail("wrong date value"));
const aTimestamp = anEmailModeSwitchLimitDate.valueOf();
const aRetrievedProfileWithTimestampBeforeLimit = {
  ...aRetrievedProfile,
  _ts: aTimestamp - 1
};
const aRetrievedProfileWithTimestampAfterLimit = {
  ...aRetrievedProfile,
  _ts: aTimestamp
};

describe("GetProfileHandler", () => {
  it("should find an existing profile", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.of(some(aValidTimestampAfterLimitRetrievedProfile));
      })
    };

    const getProfileHandler = GetProfileHandler(
      profileModelMock as any,
      anEmailModeSwitchLimitDate
    );

    const response = await getProfileHandler(aFiscalCode);

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalledWith([
      aFiscalCode
    ]);
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aExtendedProfile);
    }
  });

  it("should find an existing profile overwriting isEmailEnabled property if cosmos timestamp is before email mode switch limit date", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.of(some(aValidTimestampBeforeLimitRetrievedProfile));
      })
    };

    const getProfileHandler = GetProfileHandler(
      profileModelMock as any,
      anEmailModeSwitchLimitDate
    );

    const response = await getProfileHandler(aFiscalCode);

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalledWith([
      aFiscalCode
    ]);
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual({
        ...aExtendedProfile,
        is_email_enabled: false
      });
    }
  });

  it("should respond with NotFound if profile does not exist", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.of(none);
      })
    };

    const getProfileHandler = GetProfileHandler(
      profileModelMock as any,
      anEmailModeSwitchLimitDate
    );

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

    const getProfileHandler = GetProfileHandler(
      profileModelMock as any,
      anEmailModeSwitchLimitDate
    );

    const result = await getProfileHandler(aFiscalCode);

    expect(result.kind).toBe("IResponseErrorQuery");
  });
});
