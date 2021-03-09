// tslint:disable:no-any

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { KindEnum as DeleteKind } from "../../generated/notifications/DeleteInstallationMessage";

import { DeleteInstallationMessage } from "../../generated/notifications/DeleteInstallationMessage";
import { ActivityInput as NHCallServiceActivityInput } from "../../HandleNHDeleteInstallationCallActivityLegacy/handler";
import { ActivityResult } from "../../utils/activity";
import {
  handler,
  NhDeleteInstallationOrchestratorCallLegacyInput
} from "../handler";

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as NonEmptyString;

const aDeleteNotificationHubMessage: DeleteInstallationMessage = {
  installationId: aFiscalCodeHash,
  kind: DeleteKind.DeleteInstallation
};

const retryOptions = {
  backoffCoefficient: 1.5
};

describe("HandleNHDeleteInstallationCallOrchestratorLegacy", () => {
  it("should start the activities with the right inputs", async () => {
    const nhCallOrchestratorInput = NhDeleteInstallationOrchestratorCallLegacyInput.encode(
      {
        message: aDeleteNotificationHubMessage
      }
    );

    const callNHServiceActivityResult = ActivityResult.encode({
      kind: "SUCCESS"
    });

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(callNHServiceActivityResult),
        getInput: jest.fn(() => nhCallOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "HandleNHDeleteInstallationCallActivityLegacy",
      retryOptions,
      NHCallServiceActivityInput.encode({
        message: aDeleteNotificationHubMessage
      })
    );
  });

  it("should not start activity with wrong inputs", async () => {
    const nhCallOrchestratorInput = {
      message: "aMessage"
    };

    const callNHServiceActivityResult = ActivityResult.encode({
      kind: "SUCCESS"
    });

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(callNHServiceActivityResult),
        getInput: jest.fn(() => nhCallOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivityWithRetry).not.toBeCalled();
  });
});
