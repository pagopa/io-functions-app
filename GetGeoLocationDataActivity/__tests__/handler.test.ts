import { getGeoLocationHandler } from "../handler";
import { context } from "../../__mocks__/durable-functions";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { TransientApiCallFailure } from "../../utils/durable";

const aValidPayload = { ip_address: "127.0.0.1" as NonEmptyString };
const mockGeoLocationService = {
  getGeoLocationForIp: jest.fn().mockRejectedValue({ status: 501 })
};

describe("GetGeoLocationDataActivity", () => {
  it("should return an API_CALL_FAILURE when the call to the service goes wrong", async () => {
    const result = await getGeoLocationHandler(mockGeoLocationService)(
      context as any,
      aValidPayload
    );
    expect(TransientApiCallFailure.is(result)).toEqual(true);
  });
  it("should return a FAILURE when the input is not valid", async () => {
    const result = await getGeoLocationHandler(mockGeoLocationService)(
      context as any,
      {}
    );

    expect(result).toMatchObject({
      kind: "FAILURE",
      reason: "Error while decoding input"
    });
  });
});
