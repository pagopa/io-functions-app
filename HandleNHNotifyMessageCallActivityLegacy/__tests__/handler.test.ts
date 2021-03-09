// tslint:disable:no-any

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { getCallNHNotifyMessageActivityHandler } from "../handler";
import { ActivityInput as NHServiceActivityInput } from "../handler";

import * as azure from "azure-sb";
import { NotifyMessage } from "../../generated/notifications/NotifyMessage";

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as NonEmptyString;

const aNotifyMessage: NotifyMessage = {
  installationId: aFiscalCodeHash,
  kind: "Notify" as any,
  payload: {
    message: "message",
    message_id: "id",
    title: "title"
  }
};

const notifySpy = jest
  .spyOn(azure.NotificationHubService.prototype, "send")
  .mockImplementation((_, __, ___, cb) =>
    cb(new Error("notify error"), {} as any)
  );

describe("HandleNHNotifyMessageCallActivityLegacy", () => {
  it("should trigger a retry if notify fails", async () => {
    const handler = getCallNHNotifyMessageActivityHandler();
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
});
