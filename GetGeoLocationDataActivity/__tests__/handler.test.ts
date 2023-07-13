import { getGeoLocationHandler } from "../handler";
import { context } from "../../__mocks__/durable-functions";
import { IPString } from "@pagopa/ts-commons/lib/strings";
import { TransientNotImplementedFailure } from "../../utils/durable";

const aValidPayload = { ip_address: "127.0.0.1" as IPString };
const mockGeoLocationService = {
  getGeoLocationForIp: jest.fn().mockRejectedValue({ status: 501 })
};

describe("GetGeoLocationDataActivity", () => {
  it("should return a NOT_YET_IMPLEMENTED failure", async () => {
    const result = await getGeoLocationHandler(mockGeoLocationService)(
      context as any,
      aValidPayload
    );
    expect(TransientNotImplementedFailure.is(result)).toEqual(true);
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
