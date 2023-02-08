/* eslint-disable @typescript-eslint/no-explicit-any */

import { EmailString } from "@pagopa/ts-commons/lib/strings";

import { EmailDefaults } from "../";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  ActivityInput as SendValidationEmailActivityInput,
  getSendValidationEmailActivityHandler
} from "../handler";
import { apply } from "../../generated/templates/mailvalidation/index";

const htmlAndTextContent = "CONTENT";

jest.mock("applicationinsights", () => ({
  defaultClient: {
    trackEvent: jest.fn()
  }
}));

jest.mock("../../generated/templates/mailvalidation/index", () => ({
  apply: jest.fn(() => htmlAndTextContent)
}));

describe("SendTemplatedValidationEmailActivityHandler", () => {
  it("should send the email using the input data", async () => {
    const functionsPublicUrl = "https://publicUrl";
    const emailDefaults: EmailDefaults = {
      from: "from@example.com" as any,
      htmlToTextOptions: {},
      title: "Email title"
    };
    const mailerTransporterMock = {
      sendMail: jest.fn((_, f) => {
        f(undefined, {});
      })
    };

    const handler = getSendValidationEmailActivityHandler(
      mailerTransporterMock as any,
      emailDefaults,
      functionsPublicUrl
    );

    const input = SendValidationEmailActivityInput.encode({
      email: "email@example.com" as EmailString,
      token: "FAKE_TOKEN"
    });

    await handler(contextMock as any, input);

    expect(apply).toBeCalledWith(
      emailDefaults.title,
      `${functionsPublicUrl}/validate-profile-email?token=${input.token}`
    );
    expect(mailerTransporterMock.sendMail).toHaveBeenCalledWith(
      {
        from: emailDefaults.from,
        html: htmlAndTextContent,
        subject: emailDefaults.title,
        text: htmlAndTextContent,
        to: input.email
      },
      expect.any(Function)
    );
  });
});
