import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { apply } from "../../generated/templates/login/index";

describe("Email Templates", () => {
  it("should generate login notification email", async () => {
    const result = apply(
      "Mario" as NonEmptyString,
      "idp-prova" as NonEmptyString,
      new Date(2020, 7, 14, 12, 30)
    );

    expect(result).toMatchSnapshot();
  });
});
