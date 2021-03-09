/* tslint:disable: no-any */
// tslint:disable-next-line: no-object-mutation
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { getCallNHCreateOrUpdateInstallationActivityHandler } from "../handler";
import { ActivityInput as NHServiceActivityInput } from "../handler";

import * as azure from "azure-sb";
import { PlatformEnum } from "../../generated/backend/Platform";
import { CreateOrUpdateInstallationMessage } from "../../generated/notifications/CreateOrUpdateInstallationMessage";

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

const createOrUpdateInstallationSpy = jest
  .spyOn(azure.NotificationHubService.prototype, "createOrUpdateInstallation")
  .mockImplementation((_, cb) =>
    cb(new Error("createOrUpdateInstallation error"))
  );

describe("HandleNHCreateOrUpdateInstallationCallActivity", () => {
  it("should trigger a retry if CreateOrUpdateInstallation fails", async () => {
    const handler = getCallNHCreateOrUpdateInstallationActivityHandler();
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
});
