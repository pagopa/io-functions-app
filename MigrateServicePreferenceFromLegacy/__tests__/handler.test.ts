import { context } from "../../__mocks__/durable-functions";
import { Context } from "@azure/functions";
import { MigrateServicePreferenceFromLegacy } from "../handler";

import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

import {
  AccessReadMessageStatusEnum,
  makeServicesPreferencesDocumentId,
  NewServicePreference,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { CosmosErrorResponse } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { createTracker } from "../../__mocks__/tracking";

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
  create: jest.fn(() => TE.left({}))
} as unknown) as ServicesPreferencesModel;
const mockServicesPreferencesModel = ({
  create: jest.fn((newDocument: NewServicePreference) =>
    TE.fromEither(E.right(toRetrivedServicePreference(newDocument)))
  )
} as unknown) as ServicesPreferencesModel;

const mockTracker = createTracker("" as any);

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
      mockServicesPreferencesModel,
      mockTracker
    );

    const result = await handler(
      (context as unknown) as Context,
      legacyToAutoRawInput
    );
    expect(mockServicesPreferencesModel.create).toHaveBeenCalledTimes(1);
    expect(mockServicesPreferencesModel.create).toHaveBeenCalledWith({
      accessReadMessageStatus: AccessReadMessageStatusEnum.UNKNOWN,
      fiscalCode: autoProfile.fiscalCode,
      id: makeServicesPreferencesDocumentId(
        autoProfile.fiscalCode as FiscalCode,
        "MyServiceId" as ServiceId,
        0 as NonNegativeInteger
      ),
      serviceId: "MyServiceId",
      settingsVersion: 0,
      kind: "INewServicePreference",
      isEmailEnabled: true,
      isInboxEnabled: false,
      isWebhookEnabled: true
    } as NewServicePreference);
    expect(result).toEqual([true]);
  });

  it("GIVEN a message with legacy oldProfile not containing blocked channel, WHEN the queue handler is called, THEN must return an empty array", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: legacyProfile
    };
    const handler = MigrateServicePreferenceFromLegacy(
      mockServicesPreferencesModel,
      mockTracker
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
      mockServicesPreferencesModel,
      mockTracker
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
        TE.fromEither(
          E.left(CosmosErrorResponse({ name: "", message: "", code: 409 }))
        )
      )
    } as unknown) as ServicesPreferencesModel;
    const handler = MigrateServicePreferenceFromLegacy(
      mockServicesPreferencesModelWith409,
      mockTracker
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
      mockServicesPreferencesModelWithError,
      mockTracker
    );
    await expect(
      handler((context as unknown) as Context, legacyToAutoRawInput)
    ).rejects.not.toBeNull();
    expect(mockServicesPreferencesModelWithError.create).toHaveBeenCalledTimes(
      1
    );
  });

  it("should trace DONE event just once", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: {
        ...legacyProfile,
        blockedInboxOrChannels: {
          MyServiceId: [BlockedInboxOrChannelEnum.INBOX],
          MyOtherServiceId: [BlockedInboxOrChannelEnum.INBOX],
          MyOtherOtherServiceId: [BlockedInboxOrChannelEnum.INBOX]
        }
      }
    };

    const spiedTracker = ({
      profile: { traceMigratingServicePreferences: jest.fn() }
    } as unknown) as typeof mockTracker;

    const handler = MigrateServicePreferenceFromLegacy(
      mockServicesPreferencesModel,
      spiedTracker
    );

    const _ = await handler(
      (context as unknown) as Context,
      legacyToAutoRawInput
    );

    const spied = spiedTracker.profile
      .traceMigratingServicePreferences as jest.Mock;

    expect(spied).toHaveBeenCalledTimes(
      2 /* one with DOING and one with DONE */
    );

    expect(spied.mock.calls[0][2]).toEqual("DOING");
    expect(spied.mock.calls[1][2]).toEqual("DONE");
  });

  it("should NOT trace DONE event if at least one migration fails", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: {
        ...legacyProfile,
        blockedInboxOrChannels: {
          MyServiceId: [BlockedInboxOrChannelEnum.INBOX],
          MyOtherServiceId: [BlockedInboxOrChannelEnum.INBOX],
          MyOtherOtherServiceId: [BlockedInboxOrChannelEnum.INBOX]
        }
      }
    };

    // We have 3 preference to migrate, but we want one to fail
    (mockServicesPreferencesModel.create as jest.Mock).mockImplementationOnce(
      () => TE.left({})
    );

    const spiedTracker = ({
      profile: { traceMigratingServicePreferences: jest.fn() }
    } as unknown) as typeof mockTracker;

    const handler = MigrateServicePreferenceFromLegacy(
      mockServicesPreferencesModel,
      spiedTracker
    );

    await expect(
      handler((context as unknown) as Context, legacyToAutoRawInput)
    ).rejects.not.toBeNull();

    const spied = spiedTracker.profile
      .traceMigratingServicePreferences as jest.Mock;

    expect(spied).toHaveBeenCalledTimes(1 /* one with DOING  */);

    expect(spied.mock.calls[0][2]).toEqual("DOING");
  });
});
