import * as lolex from "lolex";

import { none, some } from "fp-ts/lib/Option";

import * as df from "durable-functions";

import { QueueClient } from "@azure/storage-queue";
import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import * as TE from "fp-ts/lib/TaskEither";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aEmailChanged,
  aFiscalCode,
  aProfile,
  aRetrievedProfile,
  autoApiProfileServicePreferencesSettings,
  autoProfileServicePreferencesSettings,
  legacyApiProfileServicePreferencesSettings,
  legacyProfileServicePreferencesSettings,
  manualApiProfileServicePreferencesSettings,
  manualProfileServicePreferencesSettings
} from "../../__mocks__/mocks";
import { OrchestratorInput as UpsertedProfileOrchestratorInput } from "../../UpsertedProfileOrchestrator/handler";
import { UpdateProfileHandler } from "../handler";

import { createTracker } from "../../__mocks__/tracking";

import { Semver } from "@pagopa/ts-commons/lib/strings";

const mockSendMessage = jest.fn().mockImplementation(() => Promise.resolve());
const mockQueueClient = ({
  sendMessage: mockSendMessage
} as unknown) as QueueClient;

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

const mockTracker = createTracker("" as any);

describe("UpdateProfileHandler", () => {
  it("should return a query error when an error occurs retrieving the existing profile", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => TE.left({}))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {} as any
    );

    expect(result.kind).toBe("IResponseErrorQuery");
  });

  it("should return a not found error if can't find an existing profile", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => TE.of(none))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {} as any
    );

    expect(result.kind).toBe("IResponseErrorNotFound");
  });

  it("should return a conflict error if the verion in the payload is not the latest", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => TE.of(some(aRetrievedProfile)))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      version: 1
    } as any);

    expect(result.kind).toBe("IResponseErrorConflict");
  });

  it("should set isEmailValidated to false if the email is changed", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        TE.of(some({ ...aRetrievedProfile, isEmailValidated: true }))
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: autoProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: manualProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: autoProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: manualProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(some({ ...aRetrievedProfile }))
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(some({ ...aRetrievedProfile }))
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: autoProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: manualProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(some({ ...aRetrievedProfile }))
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(some({ ...aRetrievedProfile }))
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: autoProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: manualProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
          TE.of(some({ ...aRetrievedProfile, acceptedTosVersion }))
        ),
        update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
      };
      const updateProfileHandler = UpdateProfileHandler(
        profileModelMock as any,
        mockQueueClient,
        mockTracker
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
      findLastVersionByModelId: jest.fn(() => TE.of(some(aRetrievedProfile))),
      update: jest.fn(() => TE.of(updatedProfile))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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

  it("should update blockedInboxOrChannels if the profile still in LEGACY mode and the migration message not be sent", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        TE.of(
          some({
            ...aRetrievedProfile,
            blockedInboxOrChannels: {
              serviceId: [BlockedInboxOrChannelEnum.INBOX]
            }
          })
        )
      ),
      update: jest.fn(p => TE.of(p))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
    );

    await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      blocked_inbox_or_channels: {
        newService: [BlockedInboxOrChannelEnum.EMAIL],
        serviceId: [BlockedInboxOrChannelEnum.INBOX]
      },
      service_preferences_settings: legacyApiProfileServicePreferencesSettings
    });

    expect(profileModelMock.update).toBeCalledWith(
      expect.objectContaining({
        blockedInboxOrChannels: {
          newService: [BlockedInboxOrChannelEnum.EMAIL],
          serviceId: [BlockedInboxOrChannelEnum.INBOX]
        },
        servicePreferencesSettings: {
          mode: ServicesPreferencesModeEnum.LEGACY,
          version: -1
        }
      })
    );
    expect(mockSendMessage).not.toBeCalled();
  });

  it("GIVEN a valid profile with mode AUTO, WHEN the update is called with current profile mode LEGACY and empty blockedInboxOrChannel, THEN the handler not send the migration message", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        TE.of(some(aRetrievedProfile))
      ),
      update: jest.fn(p => TE.of(p))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
    );

    await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: autoApiProfileServicePreferencesSettings
    });

    expect(profileModelMock.update).toBeCalledWith(
      expect.objectContaining({
        servicePreferencesSettings: {
          mode: ServicesPreferencesModeEnum.AUTO,
          version: 0
        }
      })
    );
    expect(mockSendMessage).not.toBeCalled();
  });

  it("GIVEN a valid profile with mode AUTO, WHEN the update is called with current profile mode LEGACY, THEN the handler send the migration message", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        TE.of(
          some({
            ...aRetrievedProfile,
            blockedInboxOrChannels: {
              serviceId: [BlockedInboxOrChannelEnum.INBOX]
            }
          })
        )
      ),
      update: jest.fn(p => TE.of(p))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
    );

    await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: autoApiProfileServicePreferencesSettings
    });

    expect(profileModelMock.update).toBeCalledWith(
      expect.objectContaining({
        blockedInboxOrChannels: undefined,
        servicePreferencesSettings: {
          mode: ServicesPreferencesModeEnum.AUTO,
          version: 0
        }
      })
    );
    expect(mockSendMessage).toBeCalled();
  });

  it("GIVEN a valid profile with mode AUTO, WHEN the update is called with current profile mode MANUAL, THEN the handler not send the migration message", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        TE.of(
          some({
            ...aRetrievedProfile,
            servicePreferencesSettings: manualProfileServicePreferencesSettings
          })
        )
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    mockSendMessage.mockImplementation(() => Promise.resolve());
    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
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
        TE.of(some(aRetrievedProfile))
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    mockSendMessage.mockImplementation(() => Promise.resolve());
    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
    );

    await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      service_preferences_settings: manualProfileServicePreferencesSettings
    });

    expect(mockSendMessage).toBeCalledTimes(0);
  });

  it("GIVEN a profile with a valid last_app_version, the handler should write the field and return successfully", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => TE.of(some({ ...aRetrievedProfile, lastAppVersion: undefined }))),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      last_app_version: "0.0.1" as Semver
    });

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value.last_app_version).toBe("0.0.1");
    }
  })

  it("GIVEN a profile with a valid last_app_version, the handler should overwrite the field and return successfully", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => TE.of(some({ ...aRetrievedProfile, lastAppVersion: "UNKNOWN" }))),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      last_app_version: "0.0.1" as Semver
    });

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value.last_app_version).toBe("0.0.1");
    }
  })

  it("GIVEN a profile without last_app_version field, the update function will take that field as undefined", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => TE.of(some({ ...aRetrievedProfile, lastAppVersion: "0.0.1" }))),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker
    );

    const result = await updateProfileHandler(contextMock as any, aFiscalCode, {
      ...aProfile,
      last_app_version: undefined
    });

    expect(profileModelMock.update).toBeCalledWith(
      expect.objectContaining({
        // The decode in the real update function will sort this to UNKNOWN
        lastAppVersion: undefined
      })
    )
    expect(result.kind).toBe("IResponseSuccessJson");
  })
});
