import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { apply as loginEmailApply } from "../../generated/templates/login/index";
import { apply as fallbackLoginEmailApply } from "../../generated/templates/login-fallback/index";
import { apply as validationEmailApply } from "../../generated/templates/mailvalidation/index";
import { ValidUrl } from "@pagopa/ts-commons/lib/url";

describe("Email Templates", () => {
  it("should generate login notification email", () => {
    const result = loginEmailApply(
      "Mario" as NonEmptyString,
      "idp-prova" as NonEmptyString,
      new Date(1688719769000),
      "127.0.0.1" as NonEmptyString,
      "https://example.com/token=#abcde" as NonEmptyString
    );

    expect(result).toMatchSnapshot();
  });

  it("should generate fallback login notification email", () => {
    const anAccessUrl = { href: "https://website.it" } as ValidUrl;
    const result = fallbackLoginEmailApply(
      "Mario" as NonEmptyString,
      "idp-prova" as NonEmptyString,
      new Date(1688719769000),
      "127.0.0.1" as NonEmptyString,
      anAccessUrl
    );

    expect(result).toMatchSnapshot();
  });

  it("should generate validation email", () => {
    const aTitle = "MY TITLE";
    const aValidationUrl = "https://example.com?result=success";

    const result = validationEmailApply(aTitle, aValidationUrl);
    expect(result).toMatchSnapshot();
  });
});
