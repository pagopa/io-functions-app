// tslint:disable-next-line: no-object-mutation
process.env = {
  ...process.env,
  AZURE_NH_ENDPOINT:
    "Endpoint=sb://127.0.0.1:30000;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=foobar",
  AZURE_NH_HUB_NAME: "io-notification-hub-mock"
};

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import * as nock from "nock";
import { notify } from "../notification";

describe("NotificationHubService", () => {
  it("should not use agentkeepalive when calling notification hub", async () => {
    const responseSpy = jest.fn();
    nock("https://127.0.0.1:30000")
      .post(_ => true)
      // tslint:disable-next-line: typedef
      .reply(function() {
        // tslint:disable-next-line: no-tslint-disable-all
        // tslint:disable-next-line
        console.log((this.req as any).options.agent.options.maxSockets);
        // tslint:disable-next-line: no-tslint-disable-all
        // tslint:disable-next-line
        responseSpy((this.req as any).options.agent.options.maxSockets);
      });
    await notify("x" as NonEmptyString, {
      message: "foo",
      message_id: "bar",
      title: "beef"
    }).run();
    expect(responseSpy).toHaveBeenCalledWith(undefined);
  });
});
