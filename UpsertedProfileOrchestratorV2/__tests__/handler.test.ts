/* tslint:disable:no-any */

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as df from "durable-functions";
import { Task } from "durable-functions/lib/src/classes";
import { fromArray } from "fp-ts/lib/NonEmptyArray";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aEmailChanged,
  aFiscalCode,
  aRetrievedProfile,
  autoProfileServicePreferencesSettings,
  manualProfileServicePreferencesSettings
} from "../../__mocks__/mocks";
import {
  OrchestratorInput as EmailValidationProcessOrchestratorInput,
  OrchestratorResult as EmailValidationProcessOrchestratorResult
} from "../../EmailValidationProcessOrchestrator/handler";
import {
  getUpsertedProfileOrchestratorHandler,
  OrchestratorInput as UpsertedProfileOrchestratorInput
} from "../handler";

import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { consumeGenerator } from "../../utils/durable";

const someRetryOptions = new df.RetryOptions(5000, 10);
// tslint:disable-next-line: no-object-mutation
someRetryOptions.backoffCoefficient = 1.5;

// tslint:disable-next-line: no-big-function
describe("UpsertedProfileOrchestrator", () => {
  it("should not start the EmailValidationProcessOrchestrator if the email is not changed", () => {
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.decode(
      {
        newProfile: { ...aRetrievedProfile, isWebhookEnabled: true },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
          errs
        )}`
      )
    );

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callSubOrchestratorWithRetry: jest.fn(() => undefined),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      sendCashbackMessage: false
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).not.toBeCalled();
  });

  it("should start the activities with the right inputs", async () => {
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.decode(
      {
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true // Enable inbox to start the SendWelcomeMessagesActivity
        },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
          errs
        )}`
      )
    );

    const emailValidationProcessOrchestratorResult = EmailValidationProcessOrchestratorResult.decode(
      {
        kind: "SUCCESS"
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
          errs
        )}`
      )
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: jest.fn(
          () => emailValidationProcessOrchestratorResult
        ),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      sendCashbackMessage: true
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      "EmailValidationProcessOrchestrator",
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode
      })
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );
  });

  it("should enqueue a message if the notifyOn queue name is provided when an inbox become enabled", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.decode(
      {
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true // Enable inbox to start the SendWelcomeMessagesActivity
        },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
          errs
        )}`
      )
    );

    const emailValidationProcessOrchestratorResult = EmailValidationProcessOrchestratorResult.decode(
      {
        kind: "SUCCESS"
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
          errs
        )}`
      )
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: readonly Task[]) => tasks
        },
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: jest.fn(
          () => emailValidationProcessOrchestratorResult
        ),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      notifyOn: fromArray([expectedQueueName]).getOrElseL(undefined),
      sendCashbackMessage: true
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      "EmailValidationProcessOrchestrator",
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode
      })
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "EnqueueProfileCreationEventActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        queueName: expectedQueueName
      }
    );
  });

  it("should not call UpdateSubscriptionFeedActivity if oldProfile and newProfile have the same servicePreferenceMode", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.decode(
      {
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
          servicePreferencesSettings: autoProfileServicePreferencesSettings
        },
        oldProfile: {
          ...aRetrievedProfile,
          servicePreferencesSettings: autoProfileServicePreferencesSettings
        },
        updatedAt: new Date()
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
          errs
        )}`
      )
    );

    const emailValidationProcessOrchestratorResult = EmailValidationProcessOrchestratorResult.decode(
      {
        kind: "SUCCESS"
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
          errs
        )}`
      )
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: readonly Task[]) => tasks
        },
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: jest.fn(
          () => emailValidationProcessOrchestratorResult
        ),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      notifyOn: fromArray([expectedQueueName]).getOrElseL(undefined),
      sendCashbackMessage: true
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      "EmailValidationProcessOrchestrator",
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode
      })
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).not.toHaveBeenCalledWith(
      "UpdateSubscriptionsFeedActivity",
      someRetryOptions,
      {}
    );
    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "EnqueueProfileCreationEventActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        queueName: expectedQueueName
      }
    );
  });

  it("should not call UpdateSubscriptionFeedActivity switching from LEGACY to AUTO", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.decode(
      {
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
          servicePreferencesSettings: autoProfileServicePreferencesSettings
        },
        oldProfile: {
          ...aRetrievedProfile
        },
        updatedAt: new Date()
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
          errs
        )}`
      )
    );

    const emailValidationProcessOrchestratorResult = EmailValidationProcessOrchestratorResult.decode(
      {
        kind: "SUCCESS"
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
          errs
        )}`
      )
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: readonly Task[]) => tasks
        },
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: jest.fn(
          () => emailValidationProcessOrchestratorResult
        ),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      notifyOn: fromArray([expectedQueueName]).getOrElseL(undefined),
      sendCashbackMessage: true
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      "EmailValidationProcessOrchestrator",
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode
      })
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).not.toHaveBeenCalledWith(
      "UpdateSubscriptionsFeedActivity",
      someRetryOptions,
      {}
    );
    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "EnqueueProfileCreationEventActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        queueName: expectedQueueName
      }
    );
  });

  it("should call UpdateSubscriptionFeedActivity to unsubscribe the entire profile switching from LEGACY to MANUAL", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.decode(
      {
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
          servicePreferencesSettings: manualProfileServicePreferencesSettings
        },
        oldProfile: {
          ...aRetrievedProfile
        },
        updatedAt: new Date()
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
          errs
        )}`
      )
    );

    const emailValidationProcessOrchestratorResult = EmailValidationProcessOrchestratorResult.decode(
      {
        kind: "SUCCESS"
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
          errs
        )}`
      )
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: readonly Task[]) => tasks
        },
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: jest.fn(
          () => emailValidationProcessOrchestratorResult
        ),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      notifyOn: fromArray([expectedQueueName]).getOrElseL(undefined),
      sendCashbackMessage: true
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      "EmailValidationProcessOrchestrator",
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode
      })
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "UpdateSubscriptionsFeedActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "UNSUBSCRIBED",
        subscriptionKind: "PROFILE",
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version
      }
    );
    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "EnqueueProfileCreationEventActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        queueName: expectedQueueName
      }
    );
  });

  it("should call UpdateSubscriptionFeedActivity to unsubscribe the entire profile switching from AUTO to MANUAL", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.decode(
      {
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
          servicePreferencesSettings: manualProfileServicePreferencesSettings
        },
        oldProfile: {
          ...aRetrievedProfile,
          servicePreferencesSettings: autoProfileServicePreferencesSettings
        },
        updatedAt: new Date()
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
          errs
        )}`
      )
    );

    const emailValidationProcessOrchestratorResult = EmailValidationProcessOrchestratorResult.decode(
      {
        kind: "SUCCESS"
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
          errs
        )}`
      )
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: readonly Task[]) => tasks
        },
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult) // WELCOME
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult) // HOW TO
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult) // CASHBACK
          .mockImplementationOnce(() => ({
            kind: "SUCCESS",
            preferences: []
          })),
        callSubOrchestratorWithRetry: jest.fn(
          () => emailValidationProcessOrchestratorResult
        ),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      notifyOn: fromArray([expectedQueueName]).getOrElseL(undefined),
      sendCashbackMessage: true
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      "EmailValidationProcessOrchestrator",
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode
      })
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "GetServicesPreferencesActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        settingsVersion:
          upsertedProfileOrchestratorInput.oldProfile.servicePreferencesSettings
            .version
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "UpdateSubscriptionsFeedActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "UNSUBSCRIBED",
        subscriptionKind: "PROFILE",
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version
      }
    );
    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "EnqueueProfileCreationEventActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        queueName: expectedQueueName
      }
    );
  });

  it("should call UpdateSubscriptionFeedActivity to subscribe the entire profile switching from MANUAL to AUTO", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.decode(
      {
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true, // Enable inbox to start the SendWelcomeMessagesActivity
          servicePreferencesSettings: autoProfileServicePreferencesSettings
        },
        oldProfile: {
          ...aRetrievedProfile,
          servicePreferencesSettings: manualProfileServicePreferencesSettings
        },
        updatedAt: new Date()
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
          errs
        )}`
      )
    );

    const emailValidationProcessOrchestratorResult = EmailValidationProcessOrchestratorResult.decode(
      {
        kind: "SUCCESS"
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
          errs
        )}`
      )
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: readonly Task[]) => tasks
        },
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult) // WELCOME
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult) // HOW TO
          .mockReturnValueOnce({
            kind: "SUCCESS",
            preferences: []
          }),
        callSubOrchestratorWithRetry: jest.fn(
          () => emailValidationProcessOrchestratorResult
        ),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      notifyOn: fromArray([expectedQueueName]).getOrElseL(undefined),
      sendCashbackMessage: true
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      "EmailValidationProcessOrchestrator",
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode
      })
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "GetServicesPreferencesActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        settingsVersion:
          upsertedProfileOrchestratorInput.oldProfile.servicePreferencesSettings
            .version
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "UpdateSubscriptionsFeedActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "SUBSCRIBED",
        subscriptionKind: "PROFILE",
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version
      }
    );
    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "EnqueueProfileCreationEventActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        queueName: expectedQueueName
      }
    );
  });

  it("should call UpdateSubscriptionFeedActivity with the difference between blockedInboxOrchannels when servicePreferenceMode is LEGACY", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.decode(
      {
        newProfile: {
          ...aRetrievedProfile,
          blockedInboxOrChannels: {
            service1: [BlockedInboxOrChannelEnum.INBOX],
            service2: [BlockedInboxOrChannelEnum.INBOX]
          },
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true // Enable inbox to start the SendWelcomeMessagesActivity
        },
        oldProfile: {
          ...aRetrievedProfile,
          blockedInboxOrChannels: {
            service3: [BlockedInboxOrChannelEnum.INBOX]
          }
        },
        updatedAt: new Date()
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
          errs
        )}`
      )
    );

    const emailValidationProcessOrchestratorResult = EmailValidationProcessOrchestratorResult.decode(
      {
        kind: "SUCCESS"
      }
    ).getOrElseL(errs =>
      fail(
        `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
          errs
        )}`
      )
    );

    const sendWelcomeMessagesActivityResult = "SUCCESS";

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: readonly Task[]) => tasks
        },
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(sendWelcomeMessagesActivityResult),
        callSubOrchestratorWithRetry: jest.fn(
          () => emailValidationProcessOrchestratorResult
        ),
        getInput: jest.fn(() => upsertedProfileOrchestratorInput)
      }
    };

    const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
      notifyOn: fromArray([expectedQueueName]).getOrElseL(undefined),
      sendCashbackMessage: true
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(contextMockWithDf.df.callSubOrchestratorWithRetry).toBeCalledWith(
      "EmailValidationProcessOrchestrator",
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode
      })
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "UpdateSubscriptionsFeedActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "SUBSCRIBED",
        serviceId: "service3",
        subscriptionKind: "SERVICE",
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "UpdateSubscriptionsFeedActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "UNSUBSCRIBED",
        serviceId: "service1",
        subscriptionKind: "SERVICE",
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "UpdateSubscriptionsFeedActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "UNSUBSCRIBED",
        serviceId: "service2",
        subscriptionKind: "SERVICE",
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "EnqueueProfileCreationEventActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        queueName: expectedQueueName
      }
    );
  });
});
