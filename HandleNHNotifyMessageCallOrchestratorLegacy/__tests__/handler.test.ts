// tslint:disable:no-any

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { success } from "../../utils/activity";

import { KindEnum as NotifyMessageKind } from "../../generated/notifications/NotifyMessage";
import { NotifyMessage } from "../../generated/notifications/NotifyMessage";

import { ActivityInput as NHCallServiceActivityInput } from "../../HandleNHNotifyMessageCallActivityLegacy/handler";

import {
  handler,
  NhNotifyMessageOrchestratorCallLegacyInput
} from "../handler";

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as NonEmptyString;

const aNotifyMessage: NotifyMessage = {
  installationId: aFiscalCodeHash,
  kind: NotifyMessageKind.Notify,
  payload: {
    message: "message",
    message_id: "id",
    title: "title"
  }
};

const retryOptions = {
  backoffCoefficient: 1.5
};

describe("HandleNHNotifyMessageCallOrchestratorLegacy", () => {
  it("should start the activities with the right inputs", async () => {
    const nhCallOrchestratorInput = NhNotifyMessageOrchestratorCallLegacyInput.encode(
      {
        message: aNotifyMessage
      }
    );

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest.fn().mockReturnValueOnce(success()),
        getInput: jest.fn(() => nhCallOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "HandleNHNotifyMessageCallActivityLegacy",
      retryOptions,
      NHCallServiceActivityInput.encode({
        message: aNotifyMessage
      })
    );
  });

  it("should not start activity with wrong inputs", async () => {
    const nhCallOrchestratorInput = {
      message: "aMessage"
    };

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest.fn().mockReturnValueOnce(success()),
        getInput: jest.fn(() => nhCallOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivityWithRetry).not.toBeCalled();
  });
});
