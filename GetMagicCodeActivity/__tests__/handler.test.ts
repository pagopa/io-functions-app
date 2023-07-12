import { getActivityHandler } from "../handler";
import { context } from "../../__mocks__/durable-functions";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { aFiscalCode } from "../../__mocks__/mocks";
import { TransientNotImplementedFailure } from "../../utils/durable";

const aValidPayload = {
  family_name: "foo" as NonEmptyString,
  name: "foo" as NonEmptyString,
  fiscal_code: aFiscalCode
};

const mockMagicCodeServiceClient = {
  getMagicCodeForUser: jest.fn().mockRejectedValue({ status: 501 })
};

describe("GetMagicCodeActivity", () => {
  it("should return a NOT_YET_IMPLEMENTED failure", async () => {
    const result = await getActivityHandler(mockMagicCodeServiceClient)(
      context as any,
      aValidPayload
    );
    expect(TransientNotImplementedFailure.is(result)).toEqual(true);
  });

  it("should return a FAILURE when the input is not valid", async () => {
    const result = await getActivityHandler(mockMagicCodeServiceClient)(
      context as any,
      {}
    );

    expect(result).toMatchObject({
      kind: "FAILURE",
      reason: "Error while decoding input"
    });
  });
});
