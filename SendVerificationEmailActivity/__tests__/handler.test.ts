/* tslint:disable: no-any */

import { EmailString } from "italia-ts-commons/lib/strings";

import { EmailDefaults } from "../";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  ActivityInput as SendVerificationEmailActivityInput,
  getSendVerificationEmailActivityHandler
} from "../handler";

const htmlAndTextContent = "CONTENT";

jest.mock("../../templates/html/default", () => ({
  __esModule: true,
  default: () => htmlAndTextContent
}));

describe("SendVerificationEmailActivityHandler", () => {
  it("should send the email using the input data", async () => {
    const functionsPublicApiUrl = "https://publicUrl";
    const emailDefaults: EmailDefaults = {
      from: "from@example.com" as any,
      htmlToTextOptions: {},
      organizationFiscalCode: "organizationFiscalCode" as any,
      senderOrganizationName: "senderOrganizationName" as any,
      senderService: "senderService" as any,
      title: "Email title"
    };
    const mailerTransporterMock = {
      sendMail: jest.fn((_, f) => {
        f(undefined, {});
      })
    };

    const handler = getSendVerificationEmailActivityHandler(
      mailerTransporterMock as any,
      emailDefaults,
      functionsPublicApiUrl
    );

    const input = SendVerificationEmailActivityInput.encode({
      email: "email@example.com" as EmailString,
      token: "FAKE_TOKEN"
    });

    await handler(contextMock as any, input);

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
