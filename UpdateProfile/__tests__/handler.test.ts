import * as lolex from "lolex";

import { none, some } from "fp-ts/lib/Option";

import * as df from "durable-functions";

import { QueueClient } from "@azure/storage-queue";
import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aEmailChanged,
  aFiscalCode,
  aName,
  aProfile,
  aRetrievedProfile,
  aRetrievedProfileWithEmail,
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
import { constFalse, constTrue, pipe } from "fp-ts/lib/function";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { IProfileEmailReader } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import { generateProfileEmails } from "../../__mocks__/unique-email-enforcement";
import { EmailValidationProcessParams } from "../../generated/definitions/internal/EmailValidationProcessParams";

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

const profileEmailReader: IProfileEmailReader = {
  list: generateProfileEmails(0)
};

const validUpdateProfileEmailValidationPayload = { name: aName };

describe("UpdateProfileHandler", () => {
  it("should return a query error when an error occurs retrieving the existing profile", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => TE.left({}))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {} as any,
      validUpdateProfileEmailValidationPayload
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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {} as any,
      validUpdateProfileEmailValidationPayload
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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        version: 1
      } as any,
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        email: aEmailChanged
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: legacyApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: legacyApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: undefined
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: undefined
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: undefined
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: autoApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: manualApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: manualApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: autoApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

    let expectedServicePreferencesSettingsVersion =
      legacyProfileServicePreferencesSettings.version + 1;

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value).toEqual(
        expect.objectContaining({
          service_preferences_settings: {
            mode: ServicesPreferencesModeEnum.AUTO,
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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: manualApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: autoApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

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
      acceptedTosVersion,
      _
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
        mockTracker,
        profileEmailReader,
        constTrue
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
        newProfile,
        validUpdateProfileEmailValidationPayload
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
        updatedAt: new Date(),
        name: validUpdateProfileEmailValidationPayload.name
      }
    );

    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => TE.of(some(aRetrievedProfile))),
      update: jest.fn(() => TE.of(updatedProfile))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker,
      profileEmailReader,
      constTrue
    );

    await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        email: aEmailChanged
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        blocked_inbox_or_channels: {
          newService: [BlockedInboxOrChannelEnum.EMAIL],
          serviceId: [BlockedInboxOrChannelEnum.INBOX]
        },
        service_preferences_settings: legacyApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: autoApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: autoApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: autoApiProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

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
      mockTracker,
      profileEmailReader,
      constTrue
    );

    await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        service_preferences_settings: manualProfileServicePreferencesSettings
      },
      validUpdateProfileEmailValidationPayload
    );

    expect(mockSendMessage).toBeCalledTimes(0);
  });

  it("GIVEN a profile with a valid last_app_version, the handler should write the field and return successfully", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        TE.of(some({ ...aRetrievedProfile, lastAppVersion: "UNKNOWN" }))
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        last_app_version: "0.0.1" as Semver
      },
      validUpdateProfileEmailValidationPayload
    );

    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value.last_app_version).toBe("0.0.1");
    }
  });

  it("GIVEN a profile without last_app_version field, the update function will take that field as undefined", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() => TE.of(some(aRetrievedProfile))),
      update: jest.fn(_ =>
        // lastAppVersion is set to “UNKNOWN“ by the decode inside the update method
        TE.of({ ...aRetrievedProfile, ..._, lastAppVersion: "UNKNOWN" })
      )
    };

    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker,
      profileEmailReader,
      constTrue
    );

    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        last_app_version: undefined
      },
      validUpdateProfileEmailValidationPayload
    );

    expect(profileModelMock.update).toBeCalledWith(
      expect.objectContaining({
        lastAppVersion: undefined
      })
    );
    expect(result.kind).toBe("IResponseSuccessJson");
    if (result.kind === "IResponseSuccessJson") {
      expect(result.value.last_app_version).toBeUndefined();
    }
  });

  it.each`
    description                       | givenProfile                                            | reminder_status | expectedReminderStatus
    ${"without reminderStatus"}       | ${aRetrievedProfile}                                    | ${undefined}    | ${undefined}
    ${"without reminderStatus"}       | ${aRetrievedProfile}                                    | ${"DISABLED"}   | ${"DISABLED"}
    ${"without reminderStatus"}       | ${aRetrievedProfile}                                    | ${"ENABLED"}    | ${"ENABLED"}
    ${"with unset reminderStatus"}    | ${{ ...aRetrievedProfile, reminderStatus: "UNSET" }}    | ${undefined}    | ${undefined}
    ${"with unset reminderStatus"}    | ${{ ...aRetrievedProfile, reminderStatus: "UNSET" }}    | ${"DISABLED"}   | ${"DISABLED"}
    ${"with unset reminderStatus"}    | ${{ ...aRetrievedProfile, reminderStatus: "UNSET" }}    | ${"ENABLED"}    | ${"ENABLED"}
    ${"with disabled reminderStatus"} | ${{ ...aRetrievedProfile, reminderStatus: "DISABLED" }} | ${undefined}    | ${undefined}
    ${"with disabled reminderStatus"} | ${{ ...aRetrievedProfile, reminderStatus: "DISABLED" }} | ${"DISABLED"}   | ${"DISABLED"}
    ${"with disabled reminderStatus"} | ${{ ...aRetrievedProfile, reminderStatus: "DISABLED" }} | ${"ENABLED"}    | ${"ENABLED"}
    ${"with enabled reminderStatus"}  | ${{ ...aRetrievedProfile, reminderStatus: "ENABLED" }}  | ${undefined}    | ${undefined}
    ${"with enabled reminderStatus"}  | ${{ ...aRetrievedProfile, reminderStatus: "ENABLED" }}  | ${"DISABLED"}   | ${"DISABLED"}
    ${"with enabled reminderStatus"}  | ${{ ...aRetrievedProfile, reminderStatus: "ENABLED" }}  | ${"ENABLED"}    | ${"ENABLED"}
  `(
    "GIVEN a profile item $description and reminder_status = $reminder_status from payload, the handler SHOULD save reminderStatus = $expectedReminderStatus",
    async ({
      _,
      __,
      givenProfile,
      reminder_status,
      expectedReminderStatus
    }) => {
      const profileModelMock = {
        findLastVersionByModelId: jest.fn(() => TE.of(some(givenProfile))),
        update: jest.fn(_ =>
          TE.of(
            pipe(
              RetrievedProfile.decode({ ...aRetrievedProfile, ..._ }),
              E.getOrElseW(_ => {
                throw "error";
              })
            )
          )
        )
      };

      const updateProfileHandler = UpdateProfileHandler(
        profileModelMock as any,
        mockQueueClient,
        mockTracker,
        profileEmailReader,
        constTrue
      );

      const result = await updateProfileHandler(
        contextMock as any,
        aFiscalCode,
        {
          ...aProfile,
          reminder_status
        },
        validUpdateProfileEmailValidationPayload
      );

      expect(profileModelMock.update).toBeCalledWith(
        expect.objectContaining({
          reminderStatus: reminder_status
        })
      );

      expect(result.kind).toBe("IResponseSuccessJson");
      if (result.kind === "IResponseSuccessJson") {
        expect(result.value.reminder_status).toBe(expectedReminderStatus);
      }
    }
  );

  // pushNotificationsContentType optional field tests
  it.each`
    description                                     | givenProfile                                                           | input          | expected
    ${"without pushNotificationsContentType"}       | ${aRetrievedProfile}                                                   | ${undefined}   | ${undefined}
    ${"without pushNotificationsContentType"}       | ${aRetrievedProfile}                                                   | ${"ANONYMOUS"} | ${"ANONYMOUS"}
    ${"without pushNotificationsContentType"}       | ${aRetrievedProfile}                                                   | ${"FULL"}      | ${"FULL"}
    ${"with unset pushNotificationsContentType"}    | ${{ ...aRetrievedProfile, pushNotificationsContentType: "UNSET" }}     | ${undefined}   | ${undefined}
    ${"with unset pushNotificationsContentType"}    | ${{ ...aRetrievedProfile, pushNotificationsContentType: "UNSET" }}     | ${"ANONYMOUS"} | ${"ANONYMOUS"}
    ${"with unset pushNotificationsContentType"}    | ${{ ...aRetrievedProfile, pushNotificationsContentType: "UNSET" }}     | ${"FULL"}      | ${"FULL"}
    ${"with disabled pushNotificationsContentType"} | ${{ ...aRetrievedProfile, pushNotificationsContentType: "ANONYMOUS" }} | ${undefined}   | ${undefined}
    ${"with disabled pushNotificationsContentType"} | ${{ ...aRetrievedProfile, pushNotificationsContentType: "ANONYMOUS" }} | ${"ANONYMOUS"} | ${"ANONYMOUS"}
    ${"with disabled pushNotificationsContentType"} | ${{ ...aRetrievedProfile, pushNotificationsContentType: "ANONYMOUS" }} | ${"FULL"}      | ${"FULL"}
    ${"with enabled pushNotificationsContentType"}  | ${{ ...aRetrievedProfile, pushNotificationsContentType: "FULL" }}      | ${undefined}   | ${undefined}
    ${"with enabled pushNotificationsContentType"}  | ${{ ...aRetrievedProfile, pushNotificationsContentType: "FULL" }}      | ${"ANONYMOUS"} | ${"ANONYMOUS"}
    ${"with enabled pushNotificationsContentType"}  | ${{ ...aRetrievedProfile, pushNotificationsContentType: "FULL" }}      | ${"FULL"}      | ${"FULL"}
  `(
    "GIVEN a profile item $description and pushNotificationsContentType = $input from payload, the handler SHOULD save pushNotificationsContentType = $expected",
    async ({ givenProfile, input, expected }) => {
      const profileModelMock = {
        findLastVersionByModelId: jest.fn(() => TE.of(some(givenProfile))),
        update: jest.fn(_ =>
          TE.of(
            pipe(
              RetrievedProfile.decode({ ...aRetrievedProfile, ..._ }),
              E.getOrElseW(_ => {
                throw "error";
              })
            )
          )
        )
      };

      const updateProfileHandler = UpdateProfileHandler(
        profileModelMock as any,
        mockQueueClient,
        mockTracker,
        profileEmailReader,
        constTrue
      );

      const result = await updateProfileHandler(
        contextMock as any,
        aFiscalCode,
        {
          ...aProfile,
          push_notifications_content_type: input
        },
        validUpdateProfileEmailValidationPayload
      );

      expect(profileModelMock.update).toBeCalledWith(
        expect.objectContaining({
          pushNotificationsContentType: input
        })
      );

      expect(result.kind).toBe("IResponseSuccessJson");
      if (result.kind === "IResponseSuccessJson") {
        expect(result.value.push_notifications_content_type).toBe(expected);
      }
    }
  );

  test.each([
    {
      // unique email enforcement enabled
      uee: constTrue,
      response: "IResponseErrorPreconditionFailed"
    },
    {
      // unique email enforcement disabled
      uee: constFalse,
      response: "IResponseSuccessJson"
    }
  ])(
    "when a citizen changes e-mail it should return $response if the e-mail is already taken (unique email enforcement = %uee)",
    async ({ response, uee }) => {
      const profileModelMock = {
        findLastVersionByModelId: jest.fn(() =>
          // Return a profile with a validated email
          TE.of(some(aRetrievedProfile))
        ),
        update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
      };
      const updateProfileHandler = UpdateProfileHandler(
        profileModelMock as any,
        mockQueueClient,
        mockTracker,
        {
          list: generateProfileEmails(10)
        },
        uee
      );
      const result = await updateProfileHandler(
        contextMock as any,
        aFiscalCode,
        {
          ...aProfile,
          email: aEmailChanged
        },
        validUpdateProfileEmailValidationPayload
      );
      expect(result.kind).toBe(response);
    }
  );

  it.each`
    scenario                    | isEmailValidated
    ${"email is validated"}     | ${true}
    ${"email is not validated"} | ${false}
  `(
    "when a citizen doesn't change e-mail, $scenario and the email is already taken it should return IResponseSuccessJson with the right is_email_already_taken",
    async ({ isEmailValidated }) => {
      const mockList = jest.fn(generateProfileEmails(10));

      const profileModelMock = {
        findLastVersionByModelId: jest.fn(() =>
          // Return a profile with a validated email
          TE.of(some({ ...aRetrievedProfileWithEmail, isEmailValidated }))
        ),
        update: jest.fn(_ => TE.of({ ...aRetrievedProfileWithEmail, ..._ }))
      };
      const updateProfileHandler = UpdateProfileHandler(
        profileModelMock as any,
        mockQueueClient,
        mockTracker,
        {
          list: mockList
        },
        constTrue
      );
      const result = await updateProfileHandler(
        contextMock as any,
        aFiscalCode,
        {
          ...aProfile,
          email: aRetrievedProfileWithEmail.email
        },
        validUpdateProfileEmailValidationPayload
      );
      expect(result.kind).toBe("IResponseSuccessJson");

      if (result.kind === "IResponseSuccessJson") {
        expect(result.value).toMatchObject({
          is_email_already_taken: !isEmailValidated
        });
      }

      if (isEmailValidated) expect(mockList).not.toBeCalled();
    }
  );

  it("returns 500 when the unique e-mail enforcement check fails", async () => {
    const profileModelMock = {
      findLastVersionByModelId: jest.fn(() =>
        // Return a profile with a validated email
        TE.of(some(aRetrievedProfile))
      ),
      update: jest.fn(_ => TE.of({ ...aRetrievedProfile, ..._ }))
    };
    const updateProfileHandler = UpdateProfileHandler(
      profileModelMock as any,
      mockQueueClient,
      mockTracker,
      {
        list: generateProfileEmails(1, true)
      },
      constTrue
    );
    const result = await updateProfileHandler(
      contextMock as any,
      aFiscalCode,
      {
        ...aProfile,
        email: aEmailChanged
      },
      validUpdateProfileEmailValidationPayload
    );
    expect(result.kind).toBe("IResponseErrorInternal");
  });
});
