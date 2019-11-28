/* tslint:disable:no-any */

import { context as contextMock } from "../../__mocks__/durable-functions";
import { handler } from "../handler";

describe("InitSubscriptionsFeedOrchestrator", () => {
  it("should call the activities with the right inputs", () => {
    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivity: jest.fn()
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivity).toBeCalledWith(
      "GetProfilesLatestVersionActivity"
    );
  });
});
