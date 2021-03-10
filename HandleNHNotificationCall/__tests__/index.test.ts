// tslint:disable:no-any

import * as df from "durable-functions";
import { DurableOrchestrationClient } from "durable-functions/lib/src/durableorchestrationclient";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context } from "../../__mocks__/durable-functions";

import { CreateOrUpdateInstallationMessage } from "../../generated/notifications/CreateOrUpdateInstallationMessage";
import { DeleteInstallationMessage } from "../../generated/notifications/DeleteInstallationMessage";
import { NotifyMessage } from "../../generated/notifications/NotifyMessage";
import { PlatformEnum } from "../../generated/notifications/Platform";

import { success } from "../../utils/activity";
import HandleNHNotificationCall from "../index";

const dfClient = ({
  startNew: jest.fn().mockImplementation((_, __, ___) => success())
} as any) as DurableOrchestrationClient;

jest.spyOn(df, "getClient").mockReturnValue(dfClient);

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as NonEmptyString;
const aPushChannel =
  "fLKP3EATnBI:APA91bEy4go681jeSEpLkNqhtIrdPnEKu6Dfi-STtUiEnQn8RwMfBiPGYaqdWrmzJyXIh5Yms4017MYRS9O1LGPZwA4sOLCNIoKl4Fwg7cSeOkliAAtlQ0rVg71Kr5QmQiLlDJyxcq3p";

const aDeleteInStalltionMessage: DeleteInstallationMessage = {
  installationId: aFiscalCodeHash,
  kind: "DeleteInstallation" as any
};

const aCreateOrUpdateInstallationMessage: CreateOrUpdateInstallationMessage = {
  installationId: aFiscalCodeHash,
  kind: "CreateOrUpdateInstallation" as any,
  platform: PlatformEnum.apns,
  pushChannel: aPushChannel,
  tags: [aFiscalCodeHash]
};

const aNotifyMessage: NotifyMessage = {
  installationId: aFiscalCodeHash,
  kind: "Notify" as any,
  payload: {
    message: "message",
    message_id: "id",
    title: "title"
  }
};

describe("HandleNHNotificationCall", () => {
  it("should call Delete Orchestrator when message is DeleteInstallation", async () => {
    await HandleNHNotificationCall(context as any, aDeleteInStalltionMessage);

    expect(dfClient.startNew).toHaveBeenCalledWith(
      "HandleNHDeleteInstallationCallOrchestratorLegacy",
      undefined,
      {
        message: aDeleteInStalltionMessage
      }
    );
  });

  it("should call CreateOrUpdate Orchestrator when message is CreateorUpdateInstallation", async () => {
    await HandleNHNotificationCall(
      context as any,
      aCreateOrUpdateInstallationMessage
    );

    expect(dfClient.startNew).toHaveBeenCalledWith(
      "HandleNHNotificationCallOrchestrator",
      undefined,
      {
        message: aCreateOrUpdateInstallationMessage
      }
    );
  });

  it("should call Notify Orchestrator when message is NotifyMessage", async () => {
    await HandleNHNotificationCall(context as any, aNotifyMessage);

    expect(dfClient.startNew).toHaveBeenCalledWith(
      "HandleNHNotificationCallOrchestrator",
      undefined,
      {
        message: aNotifyMessage
      }
    );
  });

  it("should not call any Orchestrator when message kind is not correct", async () => {
    const aWrongMessage = {
      installationId: aFiscalCodeHash,
      kind: "WrongMessage" as any
    };

    // tslint:disable-next-line: no-let
    let hasError = false;
    try {
      await HandleNHNotificationCall(context as any, aWrongMessage);
    } catch (error) {
      hasError = true;
    }

    expect(hasError).toBe(true);
  });
});
