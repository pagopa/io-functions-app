import { Context } from "@azure/functions";
import { QueueServiceClient } from "@azure/storage-queue";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { context } from "../../__mocks__/durable-functions";
import { getEnqueueMigrateServicesPreferencesActivityHandler } from "../handler";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";

const mockSendMessage = jest.fn();
const mockQueueService = ({
  getQueueClient: jest
    .fn()
    .mockImplementation(() => ({ sendMessage: mockSendMessage }))
} as unknown) as QueueServiceClient;

const aQueueName = "queue_name" as NonEmptyString;

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

describe("EnqueueMigrateServicesPreferencesActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("GIVEN a valid message, WHEN the activity is call, THEN the activity send the message", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: legacyProfile
    };

    const handler = getEnqueueMigrateServicesPreferencesActivityHandler(
      mockQueueService,
      aQueueName
    );
    mockSendMessage.mockImplementation(() => Promise.resolve());
    // tslint:disable-next-line: no-unused-expression
    const result = await handler(
      (context as unknown) as Context,
      legacyToAutoRawInput
    );
    expect(result).toEqual("SUCCESS");
    expect(mockSendMessage).toBeCalledWith(
      Buffer.from(JSON.stringify(legacyToAutoRawInput)).toString("base64")
    );
    expect(mockQueueService.getQueueClient).toBeCalledWith(aQueueName);
  });

  it("GIVEN a not valid message, WHEN the activity is call, THEN the activity return a failure without throwing errors", async () => {
    const legacyToAutoRawInput = {};

    const handler = getEnqueueMigrateServicesPreferencesActivityHandler(
      mockQueueService,
      aQueueName
    );
    mockSendMessage.mockImplementation(() => Promise.resolve());
    // tslint:disable-next-line: no-unused-expression
    const result = await handler(
      (context as unknown) as Context,
      legacyToAutoRawInput
    );

    expect(result).toEqual("FAILURE");
    expect(context.log.error).toBeCalled();
    expect(mockQueueService.getQueueClient).not.toBeCalled();
  });

  it("GIVEN a valid message, WHEN the activity is call with queue not working, THEN the activity throw an error", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: legacyProfile
    };

    const handler = getEnqueueMigrateServicesPreferencesActivityHandler(
      mockQueueService,
      aQueueName
    );

    mockSendMessage.mockImplementationOnce(() =>
      Promise.reject(new Error("Error"))
    );

    await expect(
      handler((context as unknown) as Context, legacyToAutoRawInput)
    ).rejects.toEqual(expect.any(Error));
    expect(mockQueueService.getQueueClient).toBeCalledWith(aQueueName);
    expect(mockSendMessage).toBeCalledWith(
      Buffer.from(JSON.stringify(legacyToAutoRawInput)).toString("base64")
    );
    expect(context.log.error).toBeCalled();
  });
});
