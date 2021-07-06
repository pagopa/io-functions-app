import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import * as df from "durable-functions";
import { IOrchestrationFunctionContext } from "durable-functions/lib/src/classes";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { getMigrateServicesPreferencesOrchestratorHandler } from "../handler";

const someRetryOptions = new df.RetryOptions(5000, 10);
// tslint:disable-next-line: no-object-mutation
someRetryOptions.backoffCoefficient = 1.5;

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

describe("MigrateServicesPreferencesOrchestrator", () => {
  it("GIVEN a not valid message, WHEN the orchestrator is call, THEN the enqueue activity is not call", async () => {
    const legacyToAutoRawInput = {};

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest.fn(),
        getInput: jest.fn(() => legacyToAutoRawInput)
      }
    };

    const orchestratorHandler = getMigrateServicesPreferencesOrchestratorHandler()(
      (contextMockWithDf as unknown) as IOrchestrationFunctionContext
    );

    const result = orchestratorHandler.next();
    expect(result.value).toBe(false);
    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a valid message, WHEN the orchestrator is call, THEN the enqueue activity is call", async () => {
    const legacyToAutoRawInput = {
      newProfile: autoProfile,
      oldProfile: {
        ...legacyProfile,
        blockedInboxOrChannels: {
          MyServiceId: [BlockedInboxOrChannelEnum.INBOX]
        }
      }
    };

    const sendWelcomeMessagesActivityResult = true;

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        getInput: jest.fn(() => legacyToAutoRawInput)
      }
    };

    const orchestratorHandler = getMigrateServicesPreferencesOrchestratorHandler()(
      (contextMockWithDf as unknown) as IOrchestrationFunctionContext
    );

    const result = orchestratorHandler.next();
    expect(result.value).toBe(true);
    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "EnqueueMigrateServicesPreferencesActivity",
      someRetryOptions,
      legacyToAutoRawInput
    );
  });
});
