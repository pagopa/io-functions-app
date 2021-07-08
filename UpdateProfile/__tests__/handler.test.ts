/* tslint:disable: no-any */

import * as lolex from "lolex";

import { none, some } from "fp-ts/lib/Option";

import * as df from "durable-functions";

import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aEmailChanged,
  aFiscalCode,
  aProfile,
  aRetrievedProfile,
  legacyApiProfileServicePreferencesSettings,
  manualApiProfileServicePreferencesSettings,
  autoApiProfileServicePreferencesSettings,
  legacyProfileServicePreferencesSettings,
  manualProfileServicePreferencesSettings,
  autoProfileServicePreferencesSettings
} from "../../__mocks__/mocks";
import { OrchestratorInput as UpsertedProfileOrchestratorInput } from "../../UpsertedProfileOrchestrator/handler";
import { UpdateProfileHandler } from "../handler";
import { QueueClient } from "@azure/storage-queue";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";

const mockSendMessage = jest.fn().mockImplementation(() => Promise.resolve());
const mockQueueClient = ({
  sendMessage: mockSendMessage
} as unknown) as QueueClient;

// tslint:disable-next-line: no-let
let clock: any;
beforeEach(() => {
  (df.getClient as any).mockClear();
  (df as any).mockStartNew.mockClear();
  // We need to mock time to test token expiration.
  clock = lolex.install({ now: Date.now() });
  mockSendMessage.mockClear();
});
afterEach(() => {
  clock = clock.uninstall();
});

describe("UpdateProfileHandler", () => {
  it("should return a query error when an error occurs retrieving the existing profile", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => fromLeft({}))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(
      contextMock as any,
      undefined as any,
      {} as any
    );

    expect(result.kind).toBe("IResponseErrorQuery");
  });

  it("should return a not found error if can't find an existing profile", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => taskEither.of(none))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(
      contextMock as any,
      undefined as any,
      {} as any
    );

    expect(result.kind).toBe("IResponseErrorNotFound");
  });

  it("should return a conflict error if the verion in the payload is not the latest", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        taskEither.of(some(aRetrievedProfile))
      )
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(
      contextMock as any,
      undefined as any,
      {
        version: 1
      } as any
    );

    expect(result.kind).toBe("IResponseErrorConflict");
  });

  it("should set isEmailValidated to false if the email is changed", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(some({ ...aRetrievedProfile, isEmailValidated: true }))
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      email: aEmailChanged
    });

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(
        expect.objectContaining({
          email: aEmailChanged,
          is_email_validated: false
        })
      );
    }
  });

  it("should return a conflict error if mode changes from AUTO to LEGACY", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: autoProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: legacyApiProfileServicePreferencesSettings
    });

    expect(result.kind).toBe("IResponseErrorConflict");
    expect(profileModelMock.findLastVersionByModelId).toBeCalled();
    expect(profileModelMock.update).not.toBeCalled();
  });

  it("should return a conflict error if mode changes from MANUAL to LEGACY", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: manualProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: legacyApiProfileServicePreferencesSettings
    });

    expect(result.kind).toBe("IResponseErrorConflict");
    expect(profileModelMock.findLastVersionByModelId).toBeCalled();
    expect(profileModelMock.update).not.toBeCalled();
  });

  it("should return a conflict error if no service_preferences_settings is sent and profile mode is AUTO", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: autoProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: undefined
    });

    expect(result.kind).toBe("IResponseErrorConflict");
    expect(profileModelMock.findLastVersionByModelId).toBeCalled();
    expect(profileModelMock.update).not.toBeCalled();
  });

  it("should return a conflict error if no service_preferences_settings is sent and profile mode is MANUAL", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: manualProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: undefined
    });

    expect(result.kind).toBe("IResponseErrorConflict");
    expect(profileModelMock.findLastVersionByModelId).toBeCalled();
    expect(profileModelMock.update).not.toBeCalled();
  });

  it("should not increment service_preferences_settings.version if no service_preferences_settings is sent and profile mode is LEGACY", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(some({ ...aRetrievedProfile }))
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: undefined
    });

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(
        expect.objectContaining({
          service_preferences_settings: {
            mode: legacyProfileServicePreferencesSettings.mode,
            version: legacyProfileServicePreferencesSettings.version
          }
        })
      );
    }
  });

  it("should not increment service_preferences_settings.version if mode remains LEGACY", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(some({ ...aRetrievedProfile }))
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile
    });

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(
        expect.objectContaining({
          service_preferences_settings: {
            mode: legacyProfileServicePreferencesSettings.mode,
            version: legacyProfileServicePreferencesSettings.version
          }
        })
      );
    }
  });

  it("should not increment service_preferences_settings.version if mode remains AUTO", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: autoProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: autoApiProfileServicePreferencesSettings
    });

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(
        expect.objectContaining({
          service_preferences_settings: {
            mode: autoProfileServicePreferencesSettings.mode,
            version: autoProfileServicePreferencesSettings.version
          }
        })
      );
    }
  });

  it("should not increment service_preferences_settings.version if mode remains MANUAL", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: manualProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: manualApiProfileServicePreferencesSettings
    });

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(
        expect.objectContaining({
          service_preferences_settings: {
            mode: manualProfileServicePreferencesSettings.mode,
            version: manualProfileServicePreferencesSettings.version
          }
        })
      );
    }
  });

  it("should increment service_preferences_settings.version if mode has changed from LEGACY to MANUAL", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(some({ ...aRetrievedProfile }))
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: manualApiProfileServicePreferencesSettings
    });

    let expectedServicePreferencesSettingsVersion =
      legacyProfileServicePreferencesSettings.version + 1;

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(
        expect.objectContaining({
          service_preferences_settings: {
            mode: manualProfileServicePreferencesSettings.mode,
            version: expectedServicePreferencesSettingsVersion
          }
        })
      );
    }
  });

  it("should increment service_preferences_settings.version if mode has changed from LEGACY to AUTO", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(some({ ...aRetrievedProfile }))
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: autoApiProfileServicePreferencesSettings
    });

    let expectedServicePreferencesSettingsVersion =
      legacyProfileServicePreferencesSettings.version + 1;

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(
        expect.objectContaining({
          service_preferences_settings: {
            mode: autoApiProfileServicePreferencesSettings.mode,
            version: expectedServicePreferencesSettingsVersion
          }
        })
      );
    }
  });

  it("should increment service_preferences_settings.version if mode has changed from AUTO to MANUAL", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: autoProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: manualApiProfileServicePreferencesSettings
    });

    let expectedServicePreferencesSettingsVersion =
      autoProfileServicePreferencesSettings.version + 1;

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(
        expect.objectContaining({
          service_preferences_settings: {
            mode: manualProfileServicePreferencesSettings.mode,
            version: expectedServicePreferencesSettingsVersion
          }
        })
      );
    }
  });

  it("should increment service_preferences_settings.version if mode has changed from MANUAL to AUTO", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: manualProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: autoApiProfileServicePreferencesSettings
    });

    let expectedServicePreferencesSettingsVersion =
      manualProfileServicePreferencesSettings.version + 1;

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(
        expect.objectContaining({
          service_preferences_settings: {
            mode: autoProfileServicePreferencesSettings.mode,
            version: expectedServicePreferencesSettingsVersion
          }
        })
      );
    }
  });

  it.each([
    [
      false,
      false,
      true,
      true,
      undefined,
      "should set isInboxEnabled and isWebhookEnabled to true if user accept ToS for the first time"
    ],
    [
      true,
      false,
      true,
      false,
      1,
      "should set isInboxEnabled to true if user has already accepted ToS"
    ],
    [
      false,
      true,
      false,
      true,
      1,
      "should set isWebhookEnabled to true if user has already accepted ToS"
    ],
    [
      undefined,
      true,
      false,
      true,
      1,
      "should keep isInboxEnabled value if not provided and user has already accepted ToS"
    ],
    [
      true,
      undefined,
      true,
      false,
      1,
      "should keep isWebhookEnabled value if not provided and user has already accepted ToS"
    ]
  ])(
    "%s, %s, %s, %s, %s",
    async (
      isInboxEnabled,
      isWebhookEnabled,
      expectedIsInboxEnabled,
      expectedIsWebHookEnabled,
      acceptedTosVersion
    ) => {
      const profileModelMock = {
        findLastVersionByModelId: jest.fn(() =>
          taskEither.of(some({ ...aRetrievedProfile, acceptedTosVersion }))
        ),
        update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
      };
      const updateProfileHandler = UpdateProfileHandler(
        profileModelMock as any,
        mockQueueClient
      );
      const newProfile = {
        ...aProfile,
        accepted_tos_version: 1,
        is_inbox_enabled: isInboxEnabled as boolean,
        is_webhook_enabled: isWebhookEnabled as boolean
      };
      const result = await updateProfileHandler(
        contextMock as any,
        aFiscalCode,
        newProfile
      );

      expect(result.kind).toBe("IResponseSuccessJson");
      if (result.kind === "IResponseSuccessJson") {
        expect(result.value).toEqual(
          expect.objectContaining({
            is_inbox_enabled: expectedIsInboxEnabled,
            is_webhook_enabled: expectedIsWebHookEnabled
          })
        );
      }
    }
  );

  it("should start the orchestrator with the appropriate input after the profile has been created", async () => {
    const updatedProfile = {
      ...aRetrievedProfile,
      email: aEmailChanged,
      isEmailValidated: false
    };
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.encode(
      {
        newProfile: updatedProfile,
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }
    );

    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        taskEither.of(some(aRetrievedProfile))
      ),
      update: jest.fn(() => taskEither.of(updatedProfile))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      email: aEmailChanged
    });

    expect(df.getClient).toHaveBeenCalledTimes(1);

    const dfClient = df.getClient(contextMock);
    expect(dfClient.startNew).toHaveBeenCalledWith(
      "UpsertedProfileOrchestrator",
      undefined,
      upsertedProfileOrchestratorInput
    );
  });

  /** */

  const baseProfile = RetrievedProfile.decode({
    _attachments: "attachments/",
    _etag: '"3500cd83-0000-0d00-0000-60e305f90000"',
    _rid: "tbAzALPWVGYLAAAAAAAAAA==",
    _self: "dbs/tbAzAA==/colls/tbAzALPWVGY=/docs/tbAzALPWVGYLAAAAAAAAAA==/",
    _ts: 1625490937,
    email: "info@agid.gov.it",
    fiscalCode: "QHBYBB58M51L494Q",
    id: "QHBYBB58M51L494Q-0000000000000000",
    isEmailEnabled: true,
    isEmailValidated: true,
    isInboxEnabled: false,
    isTestProfile: false,
    isWebhookEnabled: false,
    version: 0
  }).getOrElseL(() => {
    throw Error("wrong dummy input!");
  });

  const legacyProfile = {
    ...baseProfile,
    servicePreferencesSettings: {
      mode: ServicesPreferencesModeEnum.LEGACY,
      version: -1
    }
  };

  const autoProfile = {
    ...baseProfile,
    servicePreferencesSettings: {
      mode: ServicesPreferencesModeEnum.AUTO,
      version: 0
    }
  };

  /** */
  it("GIVEN a valid profile with mode AUTO, WHEN the update is called with current profile mode LEGACY, THEN the handler send the migration message", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(some(aRetrievedProfile))
      ),
      update: jest.fn(p => taskEither.of({ ...aRetrievedProfile, ...p }))
    };

    const expectedMessage =
      "eyJuZXdQcm9maWxlIjp7Il9ldGFnIjoiX2V0YWciLCJfcmlkIjoiX3JpZCIsIl9zZWxmIjoiX3NlbGYiLCJfdHMiOjEsImZpc2NhbENvZGUiOiJTUE5ETkw4MEExM1k1NTVYIiwiaWQiOiIxMjMiLCJpc0VtYWlsRW5hYmxlZCI6dHJ1ZSwiaXNFbWFpbFZhbGlkYXRlZCI6ZmFsc2UsImlzSW5ib3hFbmFibGVkIjpmYWxzZSwiaXNUZXN0UHJvZmlsZSI6ZmFsc2UsImlzV2ViaG9va0VuYWJsZWQiOmZhbHNlLCJzZXJ2aWNlUHJlZmVyZW5jZXNTZXR0aW5ncyI6eyJtb2RlIjoiQVVUTyIsInZlcnNpb24iOjB9LCJ2ZXJzaW9uIjowLCJlbWFpbCI6ImVtYWlsQGV4YW1wbGUuY29tIn0sIm9sZFByb2ZpbGUiOnsiX2V0YWciOiJfZXRhZyIsIl9yaWQiOiJfcmlkIiwiX3NlbGYiOiJfc2VsZiIsIl90cyI6MSwiZmlzY2FsQ29kZSI6IlNQTkROTDgwQTEzWTU1NVgiLCJpZCI6IjEyMyIsImlzRW1haWxFbmFibGVkIjp0cnVlLCJpc0VtYWlsVmFsaWRhdGVkIjp0cnVlLCJpc0luYm94RW5hYmxlZCI6ZmFsc2UsImlzVGVzdFByb2ZpbGUiOmZhbHNlLCJpc1dlYmhvb2tFbmFibGVkIjpmYWxzZSwic2VydmljZVByZWZlcmVuY2VzU2V0dGluZ3MiOnsibW9kZSI6IkxFR0FDWSIsInZlcnNpb24iOi0xfSwidmVyc2lvbiI6MH19";

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: autoApiProfileServicePreferencesSettings
    });

    expect(mockSendMessage).toBeCalledWith(expectedMessage);
  });

  it("GIVEN a valid profile with mode AUTO, WHEN the update is called with current profile mode MANUAL, THEN the handler not send the migration message", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: manualProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    mockSendMessage.mockImplementation(() => Promise.resolve());
    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: autoApiProfileServicePreferencesSettings
    });

    expect(mockSendMessage).toBeCalledTimes(0);
  });

  it("GIVEN a valid profile with mode MANUAL, WHEN the update is called with current profile mode LEGACY, THEN the handler not send the migration message", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        taskEither.of(some(aRetrievedProfile))
      ),
      update: jest.fn(_ => taskEither.of({ ...aRetrievedProfile, ..._ }))
    };

    mockSendMessage.mockImplementation(() => Promise.resolve());
    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient
    );

    await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: manualProfileServicePreferencesSettings
    });

    expect(mockSendMessage).toBeCalledTimes(0);
  });
});
