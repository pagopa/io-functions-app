// tslint:disable-next-line: no-object-mutation
process.env = {
  ...process.env,
  AZURE_NH_ENDPOINT:
    "Endpoint=sb://127.0.0.1:30000;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=foobar",
  AZURE_NH_HUB_NAME: "io-notification-hub-mock",
  FETCH_KEEPALIVE_ENABLED: "true",
  FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT: "30000",
  FETCH_KEEPALIVE_MAX_FREE_SOCKETS: "10",
  FETCH_KEEPALIVE_MAX_SOCKETS: "40",
  FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL: "110000",
  FETCH_KEEPALIVE_TIMEOUT: "60000"
};

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import * as nock from "nock";
import { ExtendedNotificationHubService, notify } from "../notification";

describe("NotificationHubService", () => {
  it("should use agentkeepalive when calling notification hub", async () => {
    const notificationHubService = new ExtendedNotificationHubService(
      process.env.AZURE_NH_HUB_NAME,
      process.env.AZURE_NH_ENDPOINT
    );

    const responseSpy = jest.fn();
    nock("https://127.0.0.1:30000")
      .post(_ => true)
      // tslint:disable-next-line: typedef
      .reply(function() {
        // tslint:disable-next-line: no-tslint-disable-all
        // tslint:disable-next-line
        responseSpy((this.req as any).options.agent.options.maxSockets);
      });
    await notify(notificationHubService, "x" as NonEmptyString, {
      message: "foo",
      message_id: "bar",
      title: "beef"
    }).run();
    expect(responseSpy).toHaveBeenCalledWith(
      parseInt(process.env.FETCH_KEEPALIVE_MAX_SOCKETS, 10)
    );
  });
});
