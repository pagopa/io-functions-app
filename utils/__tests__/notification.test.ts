process.env = {
  ...process.env,
  AZURE_NH_HUB_NAME: "io-notification-hub-mock",
  AZURE_NH_ENDPOINT:
    "Endpoint=sb://127.0.0.1:30000;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=foobar",
  FETCH_KEEPALIVE_ENABLED: "true",
  FETCH_KEEPALIVE_FREE_SOCKET_TIMEOUT: "30000",
  FETCH_KEEPALIVE_MAX_FREE_SOCKETS: "10",
  FETCH_KEEPALIVE_MAX_SOCKETS: "40",
  FETCH_KEEPALIVE_SOCKET_ACTIVE_TTL: "110000",
  FETCH_KEEPALIVE_TIMEOUT: "60000"
};

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { notify } from "../notification";
import * as nock from "nock";

describe("NotificationHubService", () => {
  it("should use agentkeepalive when calling notification hub", async () => {
    const responseSpy = jest.fn();
    const scope = nock("https://127.0.0.1:30000")
      .post(_ => true)
      .reply(function() {
        responseSpy((this.req as any).options.agent.keepAlive);
      });
    await notify("x" as NonEmptyString, {
      message: "foo",
      message_id: "bar",
      title: "beef"
    }).run();
    expect(responseSpy).toHaveBeenCalledWith(true);
  });
});
