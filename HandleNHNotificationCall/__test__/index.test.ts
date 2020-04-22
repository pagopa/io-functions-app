/* tslint:disable:no-any */
/* tslint:disable:no-object-mutation */

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { index, NotificationHubMessage } from "..";
import { PlatformEnum } from "../../generated/backend/Platform";

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as NonEmptyString;
const aPushChannel =
  "fLKP3EATnBI:APA91bEy4go681jeSEpLkNqhtIrdPnEKu6Dfi-STtUiEnQn8RwMfBiPGYaqdWrmzJyXIh5Yms4017MYRS9O1LGPZwA4sOLCNIoKl4Fwg7cSeOkliAAtlQ0rVg71Kr5QmQiLlDJyxcq3p";
const aNotificationHubMessage: NotificationHubMessage = {
  installationId: aFiscalCodeHash,
  kind: "CreateOrUpdate",
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
