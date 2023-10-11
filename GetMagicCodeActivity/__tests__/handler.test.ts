import { ActivityResultSuccess, getActivityHandler } from "../handler";
import { context } from "../../__mocks__/durable-functions";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { aFiscalCode } from "../../__mocks__/mocks";
import * as E from "fp-ts/lib/Either";
import { MagicLinkServiceClient } from "../utils";

const aValidPayload = {
  family_name: "foo" as NonEmptyString,
  name: "foo" as NonEmptyString,
  fiscal_code: aFiscalCode
};

const aValidMagicLink = "https://example.com/#token=abcde" as NonEmptyString;

const mockMagicLinkServiceClient = ({
  getMagicLinkToken: jest
    .fn()
    .mockResolvedValue(
      E.right({ status: 200, value: { magic_link: aValidMagicLink } })
    )
} as unknown) as MagicLinkServiceClient;

describe("GetMagicCodeActivity", () => {
  it("should return a success with a valid input", async () => {
    const result = await getActivityHandler(mockMagicLinkServiceClient)(
      context as any,
      aValidPayload
    );
    expect(ActivityResultSuccess.is(result)).toEqual(true);
  });

  it("should return a FAILURE when the input is not valid", async () => {
    const result = await getActivityHandler(mockMagicLinkServiceClient)(
      context as any,
      {}
    );

    expect(result).toMatchObject({
      kind: "FAILURE",
      reason: "Error while decoding input"
    });
  });
});
