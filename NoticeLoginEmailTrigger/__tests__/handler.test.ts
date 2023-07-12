import { NoticeLoginEmailHandler } from "../handler";
import * as TE from "fp-ts/lib/TaskEither";
import * as durableUtils from "../../utils/durable";
import { context } from "../../__mocks__/durable-functions";
import { aFiscalCode } from "../../__mocks__/mocks";
import {
  EmailString,
  IPString,
  NonEmptyString
} from "@pagopa/ts-commons/lib/strings";
import { response as MockResponse } from "jest-mock-express";

const aValidTriggerPayload = {
  email: "example@example.com" as EmailString,
  family_name: "example" as NonEmptyString,
  fiscal_code: aFiscalCode,
  identity_provider: "idp" as NonEmptyString,
  ip_address: "127.0.0.1" as IPString,
  name: "foo" as NonEmptyString,
  device_name: "adevice" as NonEmptyString
};

describe("NoticeLoginEmailTrigger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return internal error when the orchestrator fails to start", async () => {
    jest
      .spyOn(durableUtils, "startOrchestrator")
      .mockReturnValueOnce(TE.left(new Error("error")));
    const result = await NoticeLoginEmailHandler()(
      context as any,
      aValidTriggerPayload
    );

    expect(result).toMatchObject({
      kind: "IResponseErrorInternal",
      detail:
        "Internal server error: Error while starting the orchestrator|ERROR=Error: error"
    });
  });

  it("should succeed when the orchestrator starts", async () => {
    jest
      .spyOn(durableUtils, "startOrchestrator")
      .mockReturnValueOnce(TE.right(""));
    const result = await NoticeLoginEmailHandler()(
      context as any,
      aValidTriggerPayload
    );
    expect(result.kind).toBe("IResponseSuccessAccepted");
  });
});
