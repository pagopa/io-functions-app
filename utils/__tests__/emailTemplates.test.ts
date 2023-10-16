import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { apply as loginEmailApply } from "../../generated/templates/login/index";
import { apply as fallbackLoginEmailApply } from "../../generated/templates/login-fallback/index";

describe("Email Templates", () => {
  it("should generate login notification email", async () => {
    const result = loginEmailApply(
      "Mario" as NonEmptyString,
      "idp-prova" as NonEmptyString,
      new Date(1688719769000),
      "127.0.0.1" as NonEmptyString,
      "https://example.com/token=#abcde" as NonEmptyString
    );

    expect(result).toMatchSnapshot();
  });

  it("should generate fallback login notification email", async () => {
    const result = fallbackLoginEmailApply(
      "Mario" as NonEmptyString,
      "idp-prova" as NonEmptyString,
      new Date(1688719769000),
      "127.0.0.1" as NonEmptyString,
      "mailto:help@example.com" as NonEmptyString
    );

    expect(result).toMatchSnapshot();
  });
});
