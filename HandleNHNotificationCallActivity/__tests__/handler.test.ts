/* tslint:disable: no-any */
// tslint:disable-next-line: no-object-mutation
process.env = {
  ...process.env,
  AZURE_NH_ENDPOINT:
    "Endpoint=sb://anendpoint.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=XXX",
  AZURE_NH_HUB_NAME: "AZURE_NH_HUB_NAME",
  COSMOSDB_KEY: "key",
  COSMOSDB_NAME: "cosmoname",
  COSMOSDB_URI: "uri",
  CUSTOMCONNSTR_COSMOSDB_KEY: "key",
  CUSTOMCONNSTR_COSMOSDB_URI: "uri",
  FUNCTIONS_PUBLIC_URL: "url",
  MAILHOG_HOSTNAME: "mailhog",
  MAIL_FROM: "mail@example.it",
  MESSAGE_CONTAINER_NAME: "msg",
  NODE_ENV: "dev",
  PUBLIC_API_KEY: "key",
  PUBLIC_API_URL: "url",
  QueueStorageConnection: "foobar",
  REQ_SERVICE_ID: "req_id_dev",
  SPID_LOGS_PUBLIC_KEY: "key",
  SUBSCRIPTIONS_FEED_TABLE: "feed"
};

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { PlatformEnum } from "../../generated/backend/Platform";
import { CreateOrUpdateInstallationMessage } from "../../generated/notifications/CreateOrUpdateInstallationMessage";
import { getCallNHServiceActivityHandler } from "../handler";
import { ActivityInput as NHServiceActivityInput } from "../handler";

import * as azure from "azure-sb";
import { DeleteInstallationMessage } from "../../generated/notifications/DeleteInstallationMessage";
import { NotifyMessage } from "../../generated/notifications/NotifyMessage";

const createOrUpdateInstallationSpy = jest
  .spyOn(azure.NotificationHubService.prototype, "createOrUpdateInstallation")
  .mockImplementation((_, cb) =>
    cb(new Error("createOrUpdateInstallation error"))
  );

const notifySpy = jest
  .spyOn(azure.NotificationHubService.prototype, "send")
  .mockImplementation((_, __, ___, cb) =>
    cb(new Error("notify error"), {} as any)
  );

const deleteInstallationSpy = jest
  .spyOn(azure.NotificationHubService.prototype, "deleteInstallation")
  .mockImplementation((_, cb) => cb(new Error("deleteInstallation error")));

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as NonEmptyString;
const aPushChannel =
  "fLKP3EATnBI:APA91bEy4go681jeSEpLkNqhtIrdPnEKu6Dfi-STtUiEnQn8RwMfBiPGYaqdWrmzJyXIh5Yms4017MYRS9O1LGPZwA4sOLCNIoKl4Fwg7cSeOkliAAtlQ0rVg71Kr5QmQiLlDJyxcq3p";

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

const aDeleteInStalltionMessage: DeleteInstallationMessage = {
  installationId: aFiscalCodeHash,
  kind: "DeleteInstallation" as any
};

describe("HandleNHNotificationCallActivity", () => {
  it("should trigger a retry if CreateOrUpdateInstallation fails", async () => {
    const handler = getCallNHServiceActivityHandler();
    const input = NHServiceActivityInput.encode({
      message: aCreateOrUpdateInstallationMessage
    });
    expect.assertions(2);
    try {
      await handler(contextMock as any, input);
    } catch (e) {
      expect(createOrUpdateInstallationSpy).toHaveBeenCalledTimes(1);
      expect(e).toBeInstanceOf(Error);
    }
  });
  it("should trigger a retry if notify fails", async () => {
    const handler = getCallNHServiceActivityHandler();
    const input = NHServiceActivityInput.encode({
      message: aNotifyMessage
    });
    expect.assertions(2);
    try {
      await handler(contextMock as any, input);
    } catch (e) {
      expect(notifySpy).toHaveBeenCalledTimes(1);
      expect(e).toBeInstanceOf(Error);
    }
  });
  it("should NOT trigger a retry if deleteInstallation fails", async () => {
    const handler = getCallNHServiceActivityHandler();
    const input = NHServiceActivityInput.encode({
      message: aDeleteInStalltionMessage
    });
    const res = await handler(contextMock as any, input);
    expect(deleteInstallationSpy).toHaveBeenCalledTimes(1);
    expect(res.kind).toEqual("FAILURE");
  });
});
