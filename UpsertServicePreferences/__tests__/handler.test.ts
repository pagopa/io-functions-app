/* eslint-disable @typescript-eslint/no-explicit-any */
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import {
  aFiscalCode,
  aRetrievedProfileWithEmail,
  autoProfileServicePreferencesSettings,
  legacyProfileServicePreferencesSettings
} from "../../__mocks__/mocks";
import {
  aRetrievedService,
  aRetrievedServicePreference,
  aServiceId,
  aServicePreference
} from "../../__mocks__/mocks.service_preference";

import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { context } from "../../__mocks__/durable-functions";
import * as subscriptionFeedHandler from "../../UpdateSubscriptionsFeedActivity/handler";
import { GetUpsertServicePreferencesHandler } from "../handler";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { RetrievedService } from "@pagopa/io-functions-commons/dist/src/models/service";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { Context } from "@azure/functions";

const makeContext = () =>
  (({ ...context, bindings: {} } as unknown) as Context);

const updateSubscriptionFeedMock = jest
  .fn()
  .mockImplementation(() => Promise.resolve("SUCCESS"));
jest
  .spyOn(subscriptionFeedHandler, "updateSubscriptionFeed")
  .mockImplementation(updateSubscriptionFeedMock);

const telemetryClientMock = {
  trackEvent: jest.fn()
};

const aRetrievedProfileInValidState = {
  ...aRetrievedProfileWithEmail,
  servicePreferencesSettings: autoProfileServicePreferencesSettings
};

const profileFindLastVersionByModelIdMock = jest.fn(() => {
  return TE.of<CosmosErrors, O.Option<RetrievedProfile>>(
    O.some(aRetrievedProfileInValidState)
  );
});
const serviceFindLastVersionByModelIdMock = jest.fn(_ => {
  return TE.of<CosmosErrors, O.Option<RetrievedService>>(
    O.some(aRetrievedService)
  );
});
const servicePreferenceFindModelMock = jest
  .fn()
  .mockImplementation(_ => TE.of(O.some(aRetrievedServicePreference)));
const servicePreferenceUpsertModelMock = jest
  .fn()
  .mockImplementation(_ => TE.of(_));

const profileModelMock = {
  findLastVersionByModelId: profileFindLastVersionByModelIdMock
};
const serviceModelMock = {
  findLastVersionByModelId: serviceFindLastVersionByModelIdMock
};
const servicePreferenceModelMock = {
  find: servicePreferenceFindModelMock,
  upsert: servicePreferenceUpsertModelMock
};

const aDisabledInboxServicePreference = {
  ...aServicePreference,
  is_inbox_enabled: false
};

const upsertServicePreferencesHandler = GetUpsertServicePreferencesHandler(
  telemetryClientMock as any,
  profileModelMock as any,
  serviceModelMock as any,
  servicePreferenceModelMock as any,
  {} as any,
  "SubFeedTableName" as NonEmptyString
);

// eslint-disable-next-line sonar/sonar-max-lines-per-function
describe("UpsertServicePreferences", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return Success if user service preferences has been upserted", async () => {
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
  });

  it("should return Success if user service preferences has been upserted without updatingSubscriptionFeed if isInboxEnabled has not been changed", async () => {
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
    expect(updateSubscriptionFeedMock).not.toHaveBeenCalled();
  });

  it("should return Success if user service preferences has been upserted with subscriptionFeed UNSUBSCRIBED in case isInboxEnabled has been changed to false", async () => {
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aDisabledInboxServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aDisabledInboxServicePreference
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
    expect(updateSubscriptionFeedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: "UNSUBSCRIBED",
        subscriptionKind: "SERVICE"
      }),
      expect.anything(),
      expect.anything()
    );
  });

  it("should return Success if user service preferences has been upserted with subscriptionFeed SUBSCRIBED in case isInboxEnabled has been changed to true", async () => {
    servicePreferenceFindModelMock.mockImplementationOnce(() =>
      TE.of(O.some({ ...aRetrievedServicePreference, isInboxEnabled: false }))
    );
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
    expect(updateSubscriptionFeedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: "SUBSCRIBED",
        subscriptionKind: "SERVICE"
      }),
      expect.anything(),
      expect.anything()
    );
  });

  it("should return Success with upserted user service preferences even if subscription feed update throw an error", async () => {
    servicePreferenceFindModelMock.mockImplementationOnce(() =>
      TE.of(O.some({ ...aRetrievedServicePreference, isInboxEnabled: false }))
    );
    updateSubscriptionFeedMock.mockImplementationOnce(() =>
      Promise.reject(new Error("Subscription Feed Error"))
    );
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
    expect(updateSubscriptionFeedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: "SUBSCRIBED",
        subscriptionKind: "SERVICE"
      }),
      expect.anything(),
      expect.anything()
    );
    expect(telemetryClientMock.trackEvent).toHaveBeenCalled();
  });

  it("should return Success with upserted user service preferences even if subscription feed update returns FAILURE", async () => {
    servicePreferenceFindModelMock.mockImplementationOnce(() =>
      TE.of(O.some({ ...aRetrievedServicePreference, isInboxEnabled: false }))
    );
    updateSubscriptionFeedMock.mockImplementationOnce(() =>
      Promise.resolve("FAILURE")
    );
    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: aServicePreference
    });

    expect(profileModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(serviceModelMock.findLastVersionByModelId).toHaveBeenCalled();
    expect(servicePreferenceModelMock.upsert).toHaveBeenCalled();
    expect(servicePreferenceModelMock.find).toHaveBeenCalled();
    expect(updateSubscriptionFeedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        operation: "SUBSCRIBED",
        subscriptionKind: "SERVICE"
      }),
      expect.anything(),
      expect.anything()
    );
    expect(telemetryClientMock.trackEvent).toHaveBeenCalled();
  });

  // ---------------------------------------------
  // Errors
  // ---------------------------------------------
  it("should return IResponseErrorNotFound if no profile is found in db", async () => {
    profileFindLastVersionByModelIdMock.mockImplementationOnce(() => {
      return TE.of(O.none);
    });

    const response = await upsertServicePreferencesHandler(
      makeContext(),
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
      return TE.of(O.none);
    });

    const response = await upsertServicePreferencesHandler(
      makeContext(),
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
      return TE.left({} as CosmosErrors);
    });

    const response = await upsertServicePreferencesHandler(
      makeContext(),
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
      return TE.left({} as CosmosErrors);
    });

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery"
    });

    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if serviceSettings model find raise an error", async () => {
    servicePreferenceFindModelMock.mockImplementationOnce(() => {
      return TE.left({} as CosmosErrors);
    });

    const response = await upsertServicePreferencesHandler(
      makeContext(),
      aFiscalCode,
      aServiceId,
      aServicePreference
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery"
    });

    expect(servicePreferenceModelMock.upsert).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if serviceSettings model upsert raise an error", async () => {
    servicePreferenceUpsertModelMock.mockImplementationOnce(() => {
      return TE.left({} as CosmosErrors);
    });

    const response = await upsertServicePreferencesHandler(
      makeContext(),
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
      return TE.of(
        O.some({
          ...aRetrievedProfileInValidState,
          servicePreferencesSettings: legacyProfileServicePreferencesSettings
        })
      );
    });

    const response = await upsertServicePreferencesHandler(
      makeContext(),
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
      makeContext(),
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

  it.each`
    scenario                                                  | servicePreference     | maybeExistingServicePreference
    ${"enabled preference and no previous preferences"}       | ${aServicePreference} | ${O.none}
    ${"enabled preference and disabled previous preferences"} | ${aServicePreference} | ${O.some({ ...aRetrievedServicePreference, isInboxEnabled: false })}
  `(
    "should emit event subscription event on $scenario",
    async ({ servicePreference, maybeExistingServicePreference }) => {
      servicePreferenceFindModelMock.mockImplementationOnce(() =>
        TE.of(maybeExistingServicePreference)
      );

      const ctx = makeContext();

      const _ = await upsertServicePreferencesHandler(
        ctx,
        aFiscalCode,
        aServiceId,
        servicePreference
      );

      // we don't car of the event format, we just care relevant informations are there
      expect(ctx.bindings.apievents).toEqual(
        expect.stringContaining(aFiscalCode)
      );
      expect(ctx.bindings.apievents).toEqual(
        expect.stringContaining(aServiceId)
      );
    }
  );

  it.each`
    scenario                                                   | servicePreference                  | maybeExistingServicePreference
    ${"disabled preference and no previous preferences"}       | ${aDisabledInboxServicePreference} | ${O.none}
    ${"disabled preference and disabled previous preferences"} | ${aDisabledInboxServicePreference} | ${O.some({ ...aRetrievedServicePreference, isInboxEnabled: false })}
    ${"enabled preference and enabled previous preferences"}   | ${aServicePreference}              | ${O.some({ ...aRetrievedServicePreference, isInboxEnabled: true })}
  `(
    "should NOT emit event subscription event on $scenario",
    async ({ servicePreference, maybeExistingServicePreference }) => {
      servicePreferenceFindModelMock.mockImplementationOnce(() =>
        TE.of(maybeExistingServicePreference)
      );

      const ctx = makeContext();

      const _ = await upsertServicePreferencesHandler(
        ctx,
        aFiscalCode,
        aServiceId,
        servicePreference
      );

      // we don't car of the event format, we just care relevant informations are there
      expect(ctx.bindings.apievents).toBe(undefined);
    }
  );
});
