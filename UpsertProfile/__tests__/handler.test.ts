// tslint:disable:no-duplicate-string no-any no-console

import { right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";

import * as df from "durable-functions";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "italia-ts-commons/lib/strings";

import { RetrievedProfile } from "io-functions-commons/dist/src/models/profile";

import { ExtendedProfile } from "io-functions-commons/dist/generated/definitions/ExtendedProfile";

import { UpsertProfileHandler } from "../handler";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aProfilePayloadMock = {
  email: "x@example.com"
};

const aRetrievedProfile: RetrievedProfile = {
  _self: "123",
  _ts: 123,
  acceptedTosVersion: 1 as NonNegativeNumber,
  email: "x@example.com" as EmailString,
  fiscalCode: aFiscalCode,
  id: "123" as NonEmptyString,
  kind: "IRetrievedProfile",
  version: 1 as NonNegativeNumber
};

const aPublicExtendedProfile: ExtendedProfile = {
  accepted_tos_version: aRetrievedProfile.acceptedTosVersion,
  email: aRetrievedProfile.email,
  is_inbox_enabled: false,
  is_webhook_enabled: false,
  version: aRetrievedProfile.version
};

const nullLog = {
  error: console.error,
  verbose: console.log,
  warn: console.warn
};

const nullContext = {
  log: nullLog
} as any;

beforeEach(() => {
  (df.getClient as any).mockClear();
  (df as any).mockStartNew.mockClear();
});

describe("UpsertProfile", () => {
  it("should create a new profile", async () => {
    const profileModelMock = {
      create: jest.fn(() => {
        return Promise.resolve(right(aRetrievedProfile));
      }),
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(none));
      })
    };

    const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

    const response = await upsertProfileHandler(
      nullContext,
      aFiscalCode,
      aProfilePayloadMock as any
    );
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aRetrievedProfile.fiscalCode
    );
    expect(profileModelMock.create).toHaveBeenCalledWith(
      {
        email: "x@example.com",
        fiscalCode: aRetrievedProfile.fiscalCode
      },
      aRetrievedProfile.fiscalCode
    );
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual(aPublicExtendedProfile);
    }
    expect((df as any).mockStartNew).toHaveBeenCalledTimes(1);
    expect((df as any).mockStartNew).toHaveBeenCalledWith(
      "UpdatedProfileOrchestrator",
      undefined,
      { newProfile: aRetrievedProfile }
    );
  });

  it("should update an existing profile (no conflict)", async () => {
    // tslint:disable-next-line:no-let
    let updatedProfile: any;

    const profileModelMock = {
      create: jest.fn(),
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfile)));
      }),
      update: jest.fn((_, __, f) => {
        updatedProfile = f(aRetrievedProfile);
        return Promise.resolve(
          right(
            some({
              ...aRetrievedProfile,
              version: ((aRetrievedProfile.version as number) +
                1) as NonNegativeNumber
            })
          )
        );
      })
    };

    const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

    const profilePayloadMock = {
      accepted_tos_version: 1,
      email: "y@example.com" as EmailString,
      is_inbox_enabled: false,
      is_webhook_enabled: false,
      version: aRetrievedProfile.version
    };

    const response = await upsertProfileHandler(
      nullContext,
      aFiscalCode,
      profilePayloadMock
    );
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aRetrievedProfile.fiscalCode
    );
    expect(profileModelMock.create).not.toHaveBeenCalled();
    expect(profileModelMock.update).toHaveBeenCalledTimes(1);
    expect(updatedProfile.email).toBe("y@example.com");
    expect(response.kind).toBe("IResponseSuccessJson");
    if (response.kind === "IResponseSuccessJson") {
      expect(response.value).toEqual({
        ...aPublicExtendedProfile,
        version: ((aRetrievedProfile.version as number) +
          1) as NonNegativeNumber
      });
    }
    expect((df as any).mockStartNew).toHaveBeenCalledTimes(1);
    expect((df as any).mockStartNew).toHaveBeenCalledWith(
      "UpdatedProfileOrchestrator",
      undefined,
      {
        newProfile: {
          ...aRetrievedProfile,
          version: ((aRetrievedProfile.version as number) +
            1) as NonNegativeNumber
        },
        oldProfile: aRetrievedProfile
      }
    );
  });

  it("should update an existing profile (conflict)", async () => {
    const profileModelMock = {
      create: jest.fn(),
      findOneProfileByFiscalCode: jest.fn(() => {
        return Promise.resolve(right(some(aRetrievedProfile)));
      }),
      update: jest.fn()
    };

    const upsertProfileHandler = UpsertProfileHandler(profileModelMock as any);

    const profilePayloadMock = {
      accepted_tos_version: 1,
      email: "y@example.com" as EmailString,
      is_inbox_enabled: false,
      is_webhook_enabled: false,
      version: 0 as NonNegativeNumber
    };

    const response = await upsertProfileHandler(
      nullContext,
      aFiscalCode,
      profilePayloadMock
    );
    expect(profileModelMock.findOneProfileByFiscalCode).toHaveBeenCalledWith(
      aRetrievedProfile.fiscalCode
    );
    expect(profileModelMock.create).not.toHaveBeenCalled();
    expect(profileModelMock.update).not.toHaveBeenCalled();
    expect(response.kind).toBe("IResponseErrorConflict");
    expect((df as any).mockStartNew).toHaveBeenCalledTimes(0);
  });
});
