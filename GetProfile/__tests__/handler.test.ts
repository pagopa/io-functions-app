import { none, some } from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/Either";
import {
  aExtendedProfile,
  aFiscalCode,
  aRetrievedProfile
} from "../../__mocks__/mocks";
import { GetProfileHandler, withIsEmailAlreadyTaken } from "../handler";
import { IProfileEmailReader } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import { constTrue } from "fp-ts/lib/function";

import { generateProfileEmails } from "../../__mocks__/unique-email-enforcement";
import { ResponseErrorInternal } from "@pagopa/ts-commons/lib/responses";

// Date returns a timestamp expressed in milliseconds
const aTimestamp = Math.floor(new Date().valueOf() / 1000);
const anEmailOptOutEmailSwitchDate = new Date(aTimestamp);
const aRetrievedProfileWithTimestampBeforeLimit = {
  ...aRetrievedProfile,
  _ts: aTimestamp - 1
};
const aRetrievedProfileWithTimestampAfterLimit = {
  ...aRetrievedProfile,
  _ts: aTimestamp + 10
};

const mockList = jest.fn().mockImplementation(generateProfileEmails(7));
const profileEmailReader: IProfileEmailReader = {
  list: mockList,
  get: jest.fn()
};

describe("withIsEmailAlreadyTaken", () => {
  it("returns false if the unique email enforcement is disabled", async () => {
    const profile = await withIsEmailAlreadyTaken(
      profileEmailReader,
      false
    )({ ...aExtendedProfile, is_email_validated: false })();
    expect(profile).toMatchObject(E.of({ is_email_already_taken: false }));
  });
  it("returns false if the e-mail associated with the given profile is validated", async () => {
    const profile = await withIsEmailAlreadyTaken(
      profileEmailReader,
      true
    )(aExtendedProfile)();
    expect(profile).toMatchObject(E.of({ is_email_already_taken: false }));
  });
  it("returns true if there are profile email entries", async () => {
    const profile = await withIsEmailAlreadyTaken(
      profileEmailReader,
      true
    )({ ...aExtendedProfile, is_email_validated: false })();
    expect(profile).toMatchObject(E.of({ is_email_already_taken: true }));
  });
  it("returns TE.left(ResponseErrorInternal) on errors retrieving the profile emails", async () => {
    const profile = await withIsEmailAlreadyTaken(
      {
        list: generateProfileEmails(2, true),
        get: jest.fn()
      },
      true
    )({ ...aExtendedProfile, is_email_validated: false })();
    expect(profile).toMatchObject(
      E.left({
        kind: "IResponseErrorInternal",
        detail:
          "Internal server error: Can't check if the new e-mail is already taken"
      })
    );
  });
});

describe("GetProfileHandler", () => {
  it("should find an existing profile", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return TE.of(some(aRetrievedProfileWithTimestampAfterLimit));
      })
    };

    const getProfileHandler = GetProfileHandler(
      profileModelMock as any,
      anEmailOptOutEmailSwitchDate,
      true,
      profileEmailReader,
      constTrue
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

  it("should find an existing profile overwriting isEmailEnabled property if cosmos timestamp is before email opt out switch limit date", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return TE.of(some(aRetrievedProfileWithTimestampBeforeLimit));
      })
    };

    const getProfileHandler = GetProfileHandler(
      profileModelMock as any,
      anEmailOptOutEmailSwitchDate,
      true,
      profileEmailReader,
      constTrue
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

  it("should find an existing profile by not overwriting isEmailEnabled property if cosmos timestamp is before email opt out switch limit date", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return TE.of(some(aRetrievedProfileWithTimestampBeforeLimit));
      })
    };

    const getProfileHandler = GetProfileHandler(
      profileModelMock as any,
      anEmailOptOutEmailSwitchDate,
      false,
      profileEmailReader,
      constTrue
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

  it("should respond with NotFound if profile does not exist", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return TE.of(none);
      })
    };

    const getProfileHandler = GetProfileHandler(
      profileModelMock as any,
      anEmailOptOutEmailSwitchDate,
      true,
      profileEmailReader,
      constTrue
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
        return TE.left("error");
      })
    };

    const getProfileHandler = GetProfileHandler(
      profileModelMock as any,
      anEmailOptOutEmailSwitchDate,
      true,
      profileEmailReader,
      constTrue
    );

    const result = await getProfileHandler(aFiscalCode);

    expect(result.kind).toBe("IResponseErrorQuery");
  });

  it("should return a IResponseErrorInternal if an error occurred checking uniqueness", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return TE.of(
          some({
            ...aRetrievedProfileWithTimestampAfterLimit,
            isEmailValidated: false
          })
        );
      })
    };

    mockList.mockImplementationOnce(generateProfileEmails(2, true));

    const getProfileHandler = GetProfileHandler(
      profileModelMock as any,
      anEmailOptOutEmailSwitchDate,
      true,
      profileEmailReader,
      constTrue
    );

    const result = await getProfileHandler(aFiscalCode);

    expect(result.kind).toBe("IResponseErrorInternal");
  });
});
