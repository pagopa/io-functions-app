/* tslint:disable:no-any */
import { Context } from "@azure/functions";
import { none, some } from "fp-ts/lib/Option";
import { taskEither } from "fp-ts/lib/TaskEither";
import {
  aFiscalCode,
  legacyProfileServicePreferencesSettings,
  aRetrievedProfile,
  aProfile,
  aRetrievedProfileWithEmail,
  autoProfileServicePreferencesSettings,
  manualApiProfileServicePreferencesSettings,
  manualProfileServicePreferencesSettings
} from "../../__mocks__/mocks";
import { context } from "../../__mocks__/durable-functions";
import {
  aRetrievedServicePreference,
  aServiceId
} from "../../__mocks__/mocks.service_preference";

import { GetServicePreferencesHandler } from "../handler";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { left } from "fp-ts/lib/Either";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";

const aRetrievedProfileInValidState = {
  ...aRetrievedProfileWithEmail,
  servicePreferencesSettings: autoProfileServicePreferencesSettings
};

describe("GetServicePreferences", () => {
  it("should return existing service preference for user", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.of(some(aRetrievedProfileInValidState));
      })
    };

    const servicePreferenceModelMock = {
      find: jest.fn(_ => {
        return taskEither.of(some(aRetrievedServicePreference));
      })
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      servicePreferenceModelMock as any
    );

    const response = await getServicePreferencesHandler(
      aFiscalCode,
      aServiceId
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        is_email_enabled: true,
        is_inbox_enabled: true,
        is_webhook_enabled: true,
        settings_version: 2
      }
    });
  });

  it("should return default ENABLED preferences if no service preference is found for user and mode is AUTO", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.of(some(aRetrievedProfileInValidState));
      })
    };

    const servicePreferenceModelMock = {
      find: jest.fn(_ => {
        return taskEither.of(none);
      })
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      servicePreferenceModelMock as any
    );

    const response = await getServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        is_email_enabled: true,
        is_inbox_enabled: true,
        is_webhook_enabled: true,
        settings_version: 0
      }
    });
  });

  it("should return default DISABLED preferences if no service preference is found for user and mode is MANUAL", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.of(
          some({
            ...aRetrievedProfileInValidState,
            servicePreferencesSettings: manualProfileServicePreferencesSettings
          })
        );
      })
    };

    const servicePreferenceModelMock = {
      find: jest.fn(_ => {
        return taskEither.of(none);
      })
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      servicePreferenceModelMock as any
    );

    const response = await getServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId
    );

    expect(response).toMatchObject({
      kind: "IResponseSuccessJson",
      value: {
        is_email_enabled: false,
        is_inbox_enabled: false,
        is_webhook_enabled: false,
        settings_version: 1
      }
    });
  });

  // ---------------------------------------------
  // Errors
  // ---------------------------------------------

  it("should return IResponseErrorNotFound if no profile is found in db", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.of(none);
      })
    };

    const servicePreferenceModelMock = {
      find: jest.fn(_ => {
        return taskEither.of(some(aRetrievedServicePreference));
      })
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      servicePreferenceModelMock as any
    );

    const response = await getServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorNotFound"
    });

    expect(servicePreferenceModelMock.find).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if profile model raise an error", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.fromEither(left({} as CosmosErrors));
      })
    };

    const servicePreferenceModelMock = {
      find: jest.fn(_ => {
        return taskEither.fromEither(left({} as CosmosErrors));
      })
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      servicePreferenceModelMock as any
    );

    const response = await getServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery"
    });

    expect(servicePreferenceModelMock.find).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorConflict if profile is in LEGACY mode", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: legacyProfileServicePreferencesSettings
          })
        );
      })
    };

    const servicePreferenceModelMock = {
      find: jest.fn(_ => {
        return taskEither.fromEither(left({} as CosmosErrors));
      })
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      servicePreferenceModelMock as any
    );

    const response = await getServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorConflict"
    });

    expect(servicePreferenceModelMock.find).not.toHaveBeenCalled();
  });

  it("should return IResponseErrorQuery if service preference model raise an error", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => {
        return taskEither.of(some(aRetrievedProfileInValidState));
      })
    };

    const servicePreferenceModelMock = {
      find: jest.fn(_ => {
        return taskEither.fromEither(left({} as CosmosErrors));
      })
    };

    const getServicePreferencesHandler = GetServicePreferencesHandler(
      profileModelMock as any,
      servicePreferenceModelMock as any
    );

    const response = await getServicePreferencesHandler(
      // (context as any) as Context,
      aFiscalCode,
      aServiceId
    );

    expect(response).toMatchObject({
      kind: "IResponseErrorQuery"
    });
  });
});
