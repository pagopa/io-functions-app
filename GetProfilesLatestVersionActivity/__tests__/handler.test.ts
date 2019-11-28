/* tslint:disable: no-any */
/* tslint:disable: no-duplicate-string */

import { isRight, right } from "fp-ts/lib/Either";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { RetrievedProfile } from "io-functions-commons/dist/src/models/profile";

import { context as contextMock } from "../../__mocks__/durable-functions";
import { aRetrievedProfile } from "../../__mocks__/mocks";
import {
  ActivityResult,
  getProfilesLatestVersionActivityHandler
} from "../handler";

const fiscalCode1 = "DDDDDD80D80D800A" as FiscalCode;
const fiscalCode2 = "DDDDDD80D80D800B" as FiscalCode;
const fiscalCode3 = "DDDDDD80D80D800C" as FiscalCode;

const profile1v0: RetrievedProfile = {
  ...aRetrievedProfile,
  fiscalCode: fiscalCode1,
  version: 0 as NonNegativeNumber
};

const profile1v1 = {
  ...profile1v0,
  version: 1 as NonNegativeNumber
};

const profile2v0 = {
  ...aRetrievedProfile,
  fiscalCode: fiscalCode2,
  version: 0 as NonNegativeNumber
};

const profile3v0 = {
  ...aRetrievedProfile,
  fiscalCode: fiscalCode3,
  version: 0 as NonNegativeNumber
};

const profile3v1 = {
  ...profile3v0,
  version: 1 as NonNegativeNumber
};

const profile3v2 = {
  ...profile3v0,
  version: 2 as NonNegativeNumber
};

const retrievedProfiles: ReadonlyArray<RetrievedProfile> = [
  profile1v0,
  profile1v1,
  profile2v0,
  profile3v0,
  profile3v1,
  profile3v2
];

jest.mock("io-functions-commons/dist/src/utils/documentdb", () => ({
  ...jest.requireActual("io-functions-commons/dist/src/utils/documentdb"),
  iteratorToArray: jest.fn(() => Promise.resolve(right(retrievedProfiles)))
}));

describe("getProfilesLatestVersionActivityHandler", () => {
  it("should return the latest version of each profile", async () => {
    const profileModelMock = {
      getCollectionIterator: jest.fn()
    };

    const handler = getProfilesLatestVersionActivityHandler(
      profileModelMock as any
    );

    const activityResultJson = await handler(contextMock as any, undefined);

    const errorOrActivityResult = ActivityResult.decode(activityResultJson);

    expect(isRight(errorOrActivityResult)).toBe(true);

    if (isRight(errorOrActivityResult)) {
      const activityResult = errorOrActivityResult.value;

      expect(activityResult.kind).toBe("SUCCESS");

      if (activityResult.kind === "SUCCESS") {
        const profilesLatestVersion =
          activityResult.value.profilesLatestVersion;

        expect(Object.keys(profilesLatestVersion).length).toBe(3);
        expect(profilesLatestVersion[fiscalCode1]).toEqual(profile1v1);
        expect(profilesLatestVersion[fiscalCode2]).toEqual(profile2v0);
        expect(profilesLatestVersion[fiscalCode3]).toEqual(profile3v2);
      }
    }

    jest.unmock("io-functions-commons/dist/src/utils/documentdb");
  });
});
