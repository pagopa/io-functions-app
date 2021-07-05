/* tslint:disable:no-any */
import { none, some } from "fp-ts/lib/Option";
import { taskEither } from "fp-ts/lib/TaskEither";
import {
  aFiscalCode,
  legacyProfileServicePreferencesSettings,
  aRetrievedProfileWithEmail,
  autoProfileServicePreferencesSettings
} from "../../__mocks__/mocks";
import {
  aRetrievedService,
  aRetrievedServicePreference,
  aServiceId,
  aServicePreference
} from "../../__mocks__/mocks.service_preference";

import { GetUpsertServicePreferencesHandler } from "../handler";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { left } from "fp-ts/lib/Either";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";

const aRetrievedProfileInValidState = {
  ...aRetrievedProfileWithEmail,
  servicePreferencesSettings: autoProfileServicePreferencesSettings
};

const profileFindLastVersionByModelIdMock = jest.fn(() => {
  return taskEither.of(some(aRetrievedProfileInValidState));
});
const serviceFindLastVersionByModelIdMock = jest.fn(_ => {
  return taskEither.of(some(aRetrievedService));
});
const serviceFindModelMock = jest.fn(_ => {
  return taskEither.of(some(aRetrievedServicePreference));
});
const serviceUpsertModelMock = jest.fn(_ => {
  return taskEither.of(_);
});

const profileModelMock = {
  findLastVersionByModelId: profileFindLastVersionByModelIdMock
};
const serviceModelMock = {
  findLastVersionByModelId: serviceFindLastVersionByModelIdMock
};
const servicePreferenceModelMock = {
  find: serviceFindModelMock,
  upsert: serviceUpsertModelMock
};

const upsertServicePreferencesHandler = GetUpsertServicePreferencesHandler(
  profileModelMock as any,
  serviceModelMock as any,
  servicePreferenceModelMock as any
);

describe("UpsertServicePreferences", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return Success if user service preferences has been upserted", async () => {
    const response = await upsertServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    console.log(response);

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
  });

  // ---------------------------------------------
  // Errors
  // ---------------------------------------------
  it("should return IResponseErrorNotFound if no profile is found in db", async () => {
    profileFindLastVersionByModelIdMock.mockImplementationOnce(() => {
      return taskEither.of(none);
    });

    const response = await upsertServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorNotFound"
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorNotFound if no service is found in db", async () => {
    serviceFindLastVersionByModelIdMock.mockImplementationOnce(() => {
      return taskEither.of(none);
    });

    const response = await upsertServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorNotFound"
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if profile model raise an error", async () => {
    profileFindLastVersionByModelIdMock.mockImplementationOnce(() => {
      return taskEither.fromEither(left({} as CosmosErrors));
    });

    const response = await upsertServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery"
    });

    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if service model raise an error", async () => {
    serviceFindLastVersionByModelIdMock.mockImplementationOnce(() => {
      return taskEither.fromEither(left({} as CosmosErrors));
    });

    const response = await upsertServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery"
    });

    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if serviceSettings model raise an error", async () => {
    serviceUpsertModelMock.mockImplementationOnce(() => {
      return taskEither.fromEither(left({} as CosmosErrors));
    });

    const response = await upsertServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery"
    });

    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
  });

  it("should return IResponseErrorConflict if profile is in LEGACY mode", async () => {
    profileFindLastVersionByModelIdMock.mockImplementationOnce(() => {
      return taskEither.of(
        some({
          ...aRetrievedProfileInValidState,
          servicePreferencesSettings: legacyProfileServicePreferencesSettings
        })
      );
    });

    const response = await upsertServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorConflict"
    });

    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorConflict if service preference han a different version from profile's one", async () => {
    const response = await upsertServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId,
      {
        ...aServicePreference,
        settings_version: (Number(aServicePreference) + 1) as NonNegativeInteger
      }
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorConflict"
    });

    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });
});
