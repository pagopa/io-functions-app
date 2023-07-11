import { getGeoLocationHandler, ApiCallFailure } from "../handler";
import { context } from "../../__mocks__/durable-functions";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

const aValidPayload = { ip_address: "1.1.1.1" as NonEmptyString };

describe("GetGeoLocationDataActivity", () => {
  it("should return an API_CALL_FAILURE when the call to the service goes wrong", async () => {
    const result = await getGeoLocationHandler({})(
      context as any,
      aValidPayload
    );
    expect(ApiCallFailure.is(result)).toEqual(true);
  });
  it("should return a FAILURE when the input is not valid", async () => {
    const result = await getGeoLocationHandler({})(context as any, {});

    expect(result).toMatchObject({
      kind: "FAILURE",
      reason: "Error while decoding input"
    });
  });
});
