/* tslint:disable:no-any */
// tslint:disable-next-line: no-object-mutation
process.env = {
  ...process.env,
  AZURE_NH_ENDPOINT:
    "Endpoint=sb://io-lab-notification-hub-ns.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=C4xIzNZv4VrUnu5jkmPH635MApRUj8wABky8VfdPLqg=",
  AZURE_NH_HUB_NAME: "AZURE_NH_HUB_NAME"
};
import { context as contextMock } from "../../__mocks__/durable-functions";

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { PlatformEnum } from "../../generated/backend/Platform";
import { NotificationHubCreateOrUpdateMessage } from "../../HandleNHNotificationCall";
import {
  ActivityInput as NHCallServiceActivityInput,
  ActivityResult
} from "../../HandleNHNotificationCallActivity/handler";
import { handler, NhNotificationOrchestratorInput } from "../handler";

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as NonEmptyString;
const aPushChannel =
  "fLKP3EATnBI:APA91bEy4go681jeSEpLkNqhtIrdPnEKu6Dfi-STtUiEnQn8RwMfBiPGYaqdWrmzJyXIh5Yms4017MYRS9O1LGPZwA4sOLCNIoKl4Fwg7cSeOkliAAtlQ0rVg71Kr5QmQiLlDJyxcq3p";
const aNotificationHubMessage: NotificationHubCreateOrUpdateMessage = {
  installationId: aFiscalCodeHash,
  kind: "CreateOrUpdate",
  platform: PlatformEnum.apns,
  pushChannel: aPushChannel,
  tags: [aFiscalCodeHash]
};

describe("HandleNHNotificationCallOrchestrator", () => {
  it("should start the activities with the right inputs", async () => {
    const nhCallOrchestratorInput = NhNotificationOrchestratorInput.encode({
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
      "HandleNHNotificationCallActivity",
      NHCallServiceActivityInput.encode({
        message: aNotificationHubMessage
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
        callActivity: jest
          .fn()
          .mockReturnValueOnce(callNHServiceActivityResult),
        getInput: jest.fn(() => nhCallOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivity).not.toBeCalled();
  });
});
