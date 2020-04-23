/* tslint:disable: no-any */
// tslint:disable-next-line: no-object-mutation
process.env = {
  ...process.env,
  AZURE_NH_ENDPOINT:
    "Endpoint=sb://anendpoint.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=C4xIzNZv4VrUnu5jkmPH635MApRUj8wABky8VfduYqg=",
  AZURE_NH_HUB_NAME: "AZURE_NH_HUB_NAME"
};
import { isLeft, isRight } from "fp-ts/lib/Either";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { PlatformEnum } from "../../generated/backend/Platform";
import { NotificationHubMessageKindEnum } from "../../generated/notifications/NotificationHubMessageKind";
import { NotificationHubCreateOrUpdateInstallationMessage } from "../../HandleNHNotificationCall";
import { getCallNHServiceActivityHandler } from "../handler";
import { ActivityInput as NHServiceActivityInput } from "../handler";

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as NonEmptyString;
const aPushChannel =
  "fLKP3EATnBI:APA91bEy4go681jeSEpLkNqhtIrdPnEKu6Dfi-STtUiEnQn8RwMfBiPGYaqdWrmzJyXIh5Yms4017MYRS9O1LGPZwA4sOLCNIoKl4Fwg7cSeOkliAAtlQ0rVg71Kr5QmQiLlDJyxcq3p";

const aNotificationHubMessage: NotificationHubCreateOrUpdateInstallationMessage = {
  installationId: aFiscalCodeHash,
  kind: NotificationHubMessageKindEnum.CreateOrUpdateInstallation,
  platform: PlatformEnum.apns,
  pushChannel: aPushChannel,
  tags: [aFiscalCodeHash]
};

describe("HandleNHNotificationCallActivity", () => {
  it("should fail on NH Service call", async () => {
    const handler = getCallNHServiceActivityHandler();
    const input = NHServiceActivityInput.encode({
      message: aNotificationHubMessage
    });

    const ret = await handler(contextMock as any, input);

    expect(isLeft(ret)).toBeTruthy();
  });
});
