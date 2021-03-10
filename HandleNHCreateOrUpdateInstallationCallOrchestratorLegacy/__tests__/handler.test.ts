// tslint:disable:no-any

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { PlatformEnum } from "../../generated/backend/Platform";
import {
  CreateOrUpdateInstallationMessage,
  KindEnum as CreateOrUpdateKind
} from "../../generated/notifications/CreateOrUpdateInstallationMessage";

import { ActivityInput as NHCallServiceActivityInput } from "../../HandleNHCreateOrUpdateInstallationCallActivityLegacy/handler";
import { success } from "../../utils/activity";
import {
  handler,
  NhCreateOrUpdateInstallationOrchestratorCallLegacyInput
} from "../handler";

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as NonEmptyString;
const aPushChannel =
  "fLKP3EATnBI:APA91bEy4go681jeSEpLkNqhtIrdPnEKu6Dfi-STtUiEnQn8RwMfBiPGYaqdWrmzJyXIh5Yms4017MYRS9O1LGPZwA4sOLCNIoKl4Fwg7cSeOkliAAtlQ0rVg71Kr5QmQiLlDJyxcq3p";

const aCreateOrUpdateInstallationMessage: CreateOrUpdateInstallationMessage = {
  installationId: aFiscalCodeHash,
  kind: CreateOrUpdateKind.CreateOrUpdateInstallation,
  platform: PlatformEnum.apns,
  pushChannel: aPushChannel,
  tags: [aFiscalCodeHash]
};

const retryOptions = {
  backoffCoefficient: 1.5
};

describe("HandleNHCreateOrUpdateInstallationCallOrchestratorLegacy", () => {
  it("should start the activities with the right inputs", async () => {
    const nhCallOrchestratorInput = NhCreateOrUpdateInstallationOrchestratorCallLegacyInput.encode(
      {
        message: aCreateOrUpdateInstallationMessage
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
      "HandleNHCreateOrUpdateInstallationCallActivityLegacy",
      retryOptions,
      NHCallServiceActivityInput.encode({
        message: aCreateOrUpdateInstallationMessage
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
