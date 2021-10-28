/* eslint-disable @typescript-eslint/no-explicit-any */

import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as df from "durable-functions";
import {
  IOrchestrationFunctionContext,
  Task
} from "durable-functions/lib/src/classes";
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

import * as O from "fp-ts/lib/Option";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import {
  makeProfileCompletedEvent,
  makeServicePreferencesChangedEvent
} from "../../utils/emitted_events";
import { ServicesPreferencesModeEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/ServicesPreferencesMode";

const someRetryOptions = new df.RetryOptions(5000, 10);
// eslint-disable-next-line functional/immutable-data
someRetryOptions.backoffCoefficient = 1.5;

beforeEach(() => jest.clearAllMocks());

// eslint-disable-next-line sonar/sonar-max-lines-per-function
describe("UpsertedProfileOrchestrator", () => {
  it("should not start the EmailValidationProcessOrchestrator if the email is not changed", () => {
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
        newProfile: { ...aRetrievedProfile, isWebhookEnabled: true },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs
          )}`
        )
      )
    );

    const contextMockWithDf = {
      ...contextMock,
      df: {
        Task: {
          all: (tasks: readonly Task[]) => tasks
        },
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
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true // Enable inbox to start the SendWelcomeMessagesActivity
        },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs
          )}`
        )
      )
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS"
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs
          )}`
        )
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
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
        newProfile: {
          ...aRetrievedProfile,
          email: aEmailChanged, // Email changed to start the EmailValidationProcessOrchestrator
          isInboxEnabled: true // Enable inbox to start the SendWelcomeMessagesActivity
        },
        oldProfile: aRetrievedProfile,
        updatedAt: new Date()
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs
          )}`
        )
      )
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS"
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs
          )}`
        )
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
      notifyOn: pipe(fromArray([expectedQueueName]), O.getOrElse(undefined)),
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
      "EmitEventActivity",
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode
      )
    );
  });

  it("should not call UpdateSubscriptionFeedActivity if oldProfile and newProfile have the same servicePreferenceMode", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
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
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs
          )}`
        )
      )
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS"
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs
          )}`
        )
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
      notifyOn: pipe(fromArray([expectedQueueName]), O.getOrElse(undefined)),
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
      "EmitEventActivity",
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode
      )
    );
  });

  it("should not call UpdateSubscriptionFeedActivity switching from LEGACY to AUTO", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
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
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs
          )}`
        )
      )
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS"
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs
          )}`
        )
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
      notifyOn: pipe(
        fromArray([expectedQueueName]),
        O.getOrElse(() => undefined)
      ),
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
      "EmitEventActivity",
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode
      )
    );
  });

  it("should call UpdateSubscriptionFeedActivity to unsubscribe the entire profile switching from LEGACY to MANUAL", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
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
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs
          )}`
        )
      )
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS"
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs
          )}`
        )
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
      notifyOn: pipe(fromArray([expectedQueueName]), O.getOrElse(undefined)),
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
      "EmitEventActivity",
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode
      )
    );
  });

  it("should call UpdateSubscriptionFeedActivity to unsubscribe the entire profile switching from AUTO to MANUAL", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
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
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs
          )}`
        )
      )
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS"
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs
          )}`
        )
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
      notifyOn: pipe(fromArray([expectedQueueName]), O.getOrElse(undefined)),
      sendCashbackMessage: true
    })(contextMockWithDf as any);

    consumeGenerator(orchestratorHandler);

    expect(
      contextMockWithDf.df.callSubOrchestratorWithRetry
    ).toHaveBeenCalledWith(
      "EmailValidationProcessOrchestrator",
      expect.anything(), // retryOptions
      EmailValidationProcessOrchestratorInput.encode({
        email: aEmailChanged,
        fiscalCode: aFiscalCode
      })
    );

    let nth = 1;
    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      "GetServicesPreferencesActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        settingsVersion:
          upsertedProfileOrchestratorInput.oldProfile.servicePreferencesSettings
            .version
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      "UpdateSubscriptionsFeedActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "UNSUBSCRIBED",
        subscriptionKind: "PROFILE",
        previousPreferences: [],
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      6,
      "EmitEventActivity",
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode
      )
    );
  });

  it("should call UpdateSubscriptionFeedActivity to subscribe the entire profile switching from MANUAL to AUTO", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
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
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs
          )}`
        )
      )
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS"
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs
          )}`
        )
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
      notifyOn: pipe(fromArray([expectedQueueName]), O.getOrElse(undefined)),
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

    let nth = 1;
    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "WELCOME",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "HOWTO",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      "SendWelcomeMessagesActivity",
      someRetryOptions,
      {
        messageKind: "CASHBACK",
        profile: upsertedProfileOrchestratorInput.newProfile
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      "GetServicesPreferencesActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        settingsVersion:
          upsertedProfileOrchestratorInput.oldProfile.servicePreferencesSettings
            .version
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      "UpdateSubscriptionsFeedActivity",
      someRetryOptions,
      {
        fiscalCode: aFiscalCode,
        operation: "SUBSCRIBED",
        subscriptionKind: "PROFILE",
        previousPreferences: [],
        updatedAt: upsertedProfileOrchestratorInput.updatedAt.getTime(),
        version: upsertedProfileOrchestratorInput.newProfile.version
      }
    );

    expect(contextMockWithDf.df.callActivityWithRetry).toHaveBeenNthCalledWith(
      nth++,
      "EmitEventActivity",
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode
      )
    );
  });

  it("should call UpdateSubscriptionFeedActivity with the difference between blockedInboxOrchannels when servicePreferenceMode is LEGACY", async () => {
    const expectedQueueName = "queue_name" as NonEmptyString;
    const upsertedProfileOrchestratorInput = pipe(
      UpsertedProfileOrchestratorInput.decode({
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
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
            errs
          )}`
        )
      )
    );

    const emailValidationProcessOrchestratorResult = pipe(
      EmailValidationProcessOrchestratorResult.decode({
        kind: "SUCCESS"
      }),
      E.getOrElseW(errs =>
        fail(
          `Cannot decode EmailValidationProcessOrchestratorResult: ${readableReport(
            errs
          )}`
        )
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
      notifyOn: pipe(fromArray([expectedQueueName]), O.getOrElse(undefined)),
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
      "EmitEventActivity",
      someRetryOptions,
      makeProfileCompletedEvent(
        upsertedProfileOrchestratorInput.newProfile.fiscalCode,
        upsertedProfileOrchestratorInput.newProfile.servicePreferencesSettings
          .mode
      )
    );
  });
});

describe("UpsertedProfileOrchestrator |> emitted events", () => {
  const anyProfileCompletedEvent = {
    ...makeProfileCompletedEvent(
      aFiscalCode,
      ServicesPreferencesModeEnum.AUTO /* any value */
    ),
    payload: expect.objectContaining({ fiscalCode: aFiscalCode })
  };

  const anyPreferenceModeChangedEvent = {
    ...makeServicePreferencesChangedEvent(
      aFiscalCode,
      ServicesPreferencesModeEnum.AUTO /* any value */,
      ServicesPreferencesModeEnum.AUTO /* any value */
    ),
    payload: expect.objectContaining({ fiscalCode: aFiscalCode })
  };

  const { AUTO, MANUAL, LEGACY } = ServicesPreferencesModeEnum;

  const withInboxEnabled = p => ({ ...p, isInboxEnabled: true });
  const withInboxDisabled = p => ({ ...p, isInboxEnabled: false });
  const withEmailChanged = p => ({ ...p, email: aEmailChanged });
  const withPreferences = (mode: ServicesPreferencesModeEnum) => p => ({
    ...p,
    servicePreferencesSettings: {
      mode,
      version: mode === LEGACY ? -1 : 0
    }
  });

  // just a helper to compose profile attributes
  const profile = (...transformers) =>
    // @ts-ignore
    pipe(aRetrievedProfile, ...transformers);

  const mockUpdateSubscriptionsFeedActivity = jest.fn();
  const mockGetServicesPreferencesActivity = jest.fn().mockReturnValue({
    kind: "SUCCESS",
    preferences: []
  });
  const mockSendWelcomeMessagesActivity = jest.fn();
  const mockEmitEventActivity = jest.fn();

  const callActivityBase = (name, input) => {
    switch (name) {
      case "UpdateSubscriptionsFeedActivity":
        return mockUpdateSubscriptionsFeedActivity(input);
      case "GetServicesPreferencesActivity":
        return mockGetServicesPreferencesActivity(input);
      case "SendWelcomeMessagesActivity":
        return mockSendWelcomeMessagesActivity(input);
      case "EmitEventActivity":
        return mockEmitEventActivity(input);
    }
  };

  it.each`
    scenario                                                                       | newProfile                                             | oldProfile                                             | expectedEvents
    ${"profile just enabled its inbox"}                                            | ${profile(withInboxEnabled, withEmailChanged)}         | ${profile(withInboxDisabled)}                          | ${[anyProfileCompletedEvent]}
    ${"profile just enabled its inbox and no old profile"}                         | ${profile(withInboxEnabled, withEmailChanged)}         | ${undefined}                                           | ${[anyProfileCompletedEvent]}
    ${"profile already had inbox enabled"}                                         | ${profile(withInboxEnabled)}                           | ${profile(withInboxEnabled)}                           | ${[]}
    ${"profile already had inbox enabled and email changed"}                       | ${profile(withInboxEnabled, withEmailChanged)}         | ${profile(withInboxEnabled)}                           | ${[]}
    ${"preference mode is changed from AUTO to MANUAL with inbox already enabled"} | ${profile(withInboxEnabled, withPreferences(MANUAL))}  | ${profile(withInboxEnabled, withPreferences(AUTO))}    | ${[anyPreferenceModeChangedEvent]}
    ${"preference mode is changed from MANUAL to AUTO with inbox already enabled"} | ${profile(withInboxEnabled, withPreferences(AUTO))}    | ${profile(withInboxEnabled, withPreferences(MANUAL))}  | ${[anyPreferenceModeChangedEvent]}
    ${"preference mode is changed from AUTO to MANUAL with inbox not enabled"}     | ${profile(withInboxDisabled, withPreferences(MANUAL))} | ${profile(withInboxDisabled, withPreferences(AUTO))}   | ${[]}
    ${"preference mode is changed from MANUAL to AUTO with inbox not enabled"}     | ${profile(withInboxDisabled, withPreferences(AUTO))}   | ${profile(withInboxDisabled, withPreferences(MANUAL))} | ${[]}
  `(
    "should emit expected events when $scenario",
    ({ expectedEvents, newProfile, oldProfile }) => {
      const orchestratorInput = pipe(
        {
          newProfile,
          updatedAt: new Date(),
          oldProfile
        },
        UpsertedProfileOrchestratorInput.decode,
        E.getOrElseW(errs =>
          fail(
            `Cannot decode UpsertedProfileOrchestratorInput: ${readableReport(
              errs
            )}`
          )
        )
      );

      const mockContextWithDf = ({
        ...contextMock,
        df: {
          Task: {
            all: (tasks: readonly Task[]) => tasks
          },
          callActivityWithRetry: jest
            .fn()
            .mockImplementation((name, _, input) =>
              callActivityBase(name, input)
            ),
          callSubOrchestratorWithRetry: jest.fn(),
          getInput: jest.fn(() => orchestratorInput)
        }
      } as unknown) as IOrchestrationFunctionContext;

      const orchestratorHandler = getUpsertedProfileOrchestratorHandler({
        notifyOn: undefined,
        sendCashbackMessage: true
      })(mockContextWithDf);

      consumeGenerator(orchestratorHandler);

      // expect every event to be emitted
      expectedEvents.forEach(evt => {
        expect(mockEmitEventActivity).toBeCalledWith(evt);
      });

      expect(mockEmitEventActivity).toBeCalledTimes(expectedEvents.length);
    }
  );
});
