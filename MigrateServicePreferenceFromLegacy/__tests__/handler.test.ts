import { context } from "../../__mocks__/durable-functions";
import { Context } from "@azure/functions";
import { MigrateServicePreferenceFromLegacy } from "../handler";
import * as e from "fp-ts/lib/Either";
import * as te from "fp-ts/lib/TaskEither";
import {
  NewServicePreference,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { CosmosErrorResponse } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";

const baseProfile = {
  email: "info@agid.gov.it",
  fiscalCode: "QHBYBB58M51L494Q",
  isEmailEnabled: true,
  isEmailValidated: true,
  isInboxEnabled: false,
  isTestProfile: false,
  isWebhookEnabled: false,
  id: "QHBYBB58M51L494Q-0000000000000000",
  version: 0,
  _rid: "tbAzALPWVGYLAAAAAAAAAA==",
  _self: "dbs/tbAzAA==/colls/tbAzALPWVGY=/docs/tbAzALPWVGYLAAAAAAAAAA==/",
  _etag: '"3500cd83-0000-0d00-0000-60e305f90000"',
  _attachments: "attachments/",
  _ts: 1625490937
};

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

// const newServPref = {
//   fiscalCode: "XDNNWA12H81Y874G",
//   id: "XDNNWA12H81Y874G-MyServiceId-0000000000000000",
//   isEmailEnabled: false,
//   isInboxEnabled: true,
//   isWebhookEnabled: false,
//   serviceId: "MyServiceId",
//   settingsVersion: 0
// };

const toRetrivedServicePreference = (newDocument: NewServicePreference) => ({
  ...newDocument,
  _rid: "tbAzAI8Cu4EFAAAAAAAAAA==",
  _self: "dbs/tbAzAA==/colls/tbAzAI8Cu4E=/docs/tbAzAI8Cu4EFAAAAAAAAAA==/",
  _etag: '"35006a7b-0000-0d00-0000-60e3044f0000"',
  _attachments: "attachments/",
  _ts: 1625490511
});

const mockServicesPreferencesModelWithError = ({
  create: jest.fn(() => te.fromLeft({}))
} as unknown) as ServicesPreferencesModel;
const mockServicesPreferencesModel = ({
  create: jest.fn((newDocument: NewServicePreference) =>
    te.fromEither(e.right(toRetrivedServicePreference(newDocument)))
  )
} as unknown) as ServicesPreferencesModel;

describe("MigrateServicePreferenceFromLegacy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("GIVEN a message with legacy oldProfile containing blocked channel, WHEN the queue handler is called, THEN must return a true filled array", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: {
        ...legacyProfile,
        blockedInboxOrChannels: {
          MyServiceId: [BlockedInboxOrChannelEnum.INBOX]
        }
      }
    };
    const handler = MigrateServicePreferenceFromLegacy(
      mockServicesPreferencesModel
    );
    const result = await handler(
      (context as unknown) as Context,
      legacyToAutoRawInput
    );
    expect(mockServicesPreferencesModel.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual([true]);
  });

  it("GIVEN a message with legacy oldProfile not containing blocked channel, WHEN the queue handler is called, THEN must return an empty array", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: legacyProfile
    };
    const handler = MigrateServicePreferenceFromLegacy(
      mockServicesPreferencesModel
    );
    const result = await handler(
      (context as unknown) as Context,
      legacyToAutoRawInput
    );
    expect(mockServicesPreferencesModel.create).toHaveBeenCalledTimes(0);
    expect(result).toEqual([]);
  });

  it("GIVEN a not valid message, WHEN the queue handler is called, THEN must throw an error", async () => {
    const handler = MigrateServicePreferenceFromLegacy(
      mockServicesPreferencesModel
    );
    await expect(
      handler((context as unknown) as Context, {})
    ).rejects.not.toBeNull();
    expect(mockServicesPreferencesModel.create).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a message with legacy oldProfile containing blocked channel, WHEN the queue handler is called with ServicesPreferences already created, THEN must return a true filled array", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: {
        ...legacyProfile,
        blockedInboxOrChannels: {
          MyServiceId: [BlockedInboxOrChannelEnum.INBOX]
        }
      }
    };
    const mockServicesPreferencesModelWith409 = ({
      create: jest.fn((newDocument: NewServicePreference) =>
        te.fromEither(
          e.left(CosmosErrorResponse({ name: "", message: "", code: 409 }))
        )
      )
    } as unknown) as ServicesPreferencesModel;
    const handler = MigrateServicePreferenceFromLegacy(
      mockServicesPreferencesModelWith409
    );
    const result = await handler(
      (context as unknown) as Context,
      legacyToAutoRawInput
    );
    expect(mockServicesPreferencesModelWith409.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual([false]);
  });

  it("GIVEN a valid message, WHEN the queue handler is called with cosmosdb not working, THEN must throw an error", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: {
        ...legacyProfile,
        blockedInboxOrChannels: {
          MyServiceId: [BlockedInboxOrChannelEnum.INBOX]
        }
      }
    };
    const handler = MigrateServicePreferenceFromLegacy(
      mockServicesPreferencesModelWithError
    );
    await expect(
      handler((context as unknown) as Context, legacyToAutoRawInput)
    ).rejects.not.toBeNull();
    expect(mockServicesPreferencesModelWithError.create).toHaveBeenCalledTimes(
      1
    );
  });
});
