/* tslint:disable:no-any */
/* tslint:disable:no-duplicate-string */

import { right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "italia-ts-commons/lib/strings";

import { RetrievedProfile } from "io-functions-commons/dist/src/models/profile";

import { ExtendedProfile } from "io-functions-commons/dist/generated/definitions/ExtendedProfile";

import { GetProfileHandler } from "../handler";

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

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
      expect(response.value).toEqual(aPublicExtendedProfile);
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
