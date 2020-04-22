/* tslint:disable:no-any */
/* tslint:disable:no-object-mutation */

import { FiscalCodeHash, index, NotificationHubMessage } from "..";
import { PlatformEnum } from "../../generated/backend/Platform";

process.env = {
  APPINSIGHTS_INSTRUMENTATIONKEY: "foo",
  QueueStorageConnection: "foobar",
  SPID_BLOB_CONTAINER_NAME: "spidblob",
  SPID_BLOB_STORAGE_CONNECTION_STRING: "foobar",
  SPID_LOGS_PUBLIC_KEY: `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDhiXpvLD8UMMUy1T2JCzo/Sj5E
l09Fs0z2U4aA37BrXlSo1DwQ2O9i2XFxXGJmE83siSWEfRlMWlabMu7Yj6dkZvmj
dGIO4gotO33TgiAQcwRo+4pwjoCN7Td47yssCcj9C727zBt+Br+XK7B1bRcqjc0J
YdF4yiVtD7G4RDXmRQIDAQAB
-----END PUBLIC KEY-----`
};

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as FiscalCodeHash;
const aPushChannel =
  "fLKP3EATnBI:APA91bEy4go681jeSEpLkNqhtIrdPnEKu6Dfi-STtUiEnQn8RwMfBiPGYaqdWrmzJyXIh5Yms4017MYRS9O1LGPZwA4sOLCNIoKl4Fwg7cSeOkliAAtlQ0rVg71Kr5QmQiLlDJyxcq3p";
const aNotificationHubMessage: NotificationHubMessage = {
  installationId: aFiscalCodeHash,
  kind: "CreateOrUpdateKind",
  platform: PlatformEnum.apns,
  pushChannel: aPushChannel,
  tags: [aFiscalCodeHash]
};

describe("NHCallService", () => {
  it("should fail on invalid payload published into the queue", async () => {
    const mockedContext = {
      bindings: {
        notificationHubMessage: aNotificationHubMessage
      },
      done: jest.fn(),
      log: {
        error: jest.fn()
      }
    };
    await index(mockedContext as any, {
      ...aNotificationHubMessage
    });
  });
});
