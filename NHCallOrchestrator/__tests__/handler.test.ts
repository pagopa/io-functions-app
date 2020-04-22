/* tslint:disable:no-any */

import { context as contextMock } from "../../__mocks__/durable-functions";

import { PlatformEnum } from "../../generated/backend/Platform";
import {
  FiscalCodeHash,
  NotificationHubCreateOrUpdateMessage
} from "../../NHCallService";
import {
  ActivityInput as NHCallServiceActivityInput,
  ActivityResult
} from "../../NHCallServiceActivity/handler";
import {
  handler,
  OrchestratorInput as NhCallOrchestratorInput
} from "../handler";

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as FiscalCodeHash;
const aPushChannel =
  "fLKP3EATnBI:APA91bEy4go681jeSEpLkNqhtIrdPnEKu6Dfi-STtUiEnQn8RwMfBiPGYaqdWrmzJyXIh5Yms4017MYRS9O1LGPZwA4sOLCNIoKl4Fwg7cSeOkliAAtlQ0rVg71Kr5QmQiLlDJyxcq3p";
const aNotificationHubMessage: NotificationHubCreateOrUpdateMessage = {
  installationId: aFiscalCodeHash,
  kind: "CreateOrUpdateKind",
  platform: PlatformEnum.apns,
  pushChannel: aPushChannel,
  tags: [aFiscalCodeHash]
};

describe("NHCallOrchestrator", () => {
  it("should start the activities with the right inputs", async () => {
    const nhCallOrchestratorInput = NhCallOrchestratorInput.encode({
      message: aNotificationHubMessage
    });

    const callNHServiceActivityResult = ActivityResult.encode({
      kind: "SUCCESS"
    });

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivity: jest
          .fn()
          .mockReturnValueOnce(callNHServiceActivityResult),
        getInput: jest.fn(() => nhCallOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivity).toBeCalledWith(
      "NHCallServiceActivity",
      NHCallServiceActivityInput.encode({
        message: aNotificationHubMessage
      })
    );
  });
});
