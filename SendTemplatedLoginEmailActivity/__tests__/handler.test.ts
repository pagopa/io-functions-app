import { ActivityInput, getSendLoginEmailActivityHandler } from "../handler";
import { context } from "../../__mocks__/durable-functions";
import {
  EmailString,
  IPString,
  NonEmptyString
} from "@pagopa/ts-commons/lib/strings";
import { EmailDefaults } from "../index";
import * as ai from "applicationinsights";
import * as mailTemplate from "../../generated/templates/login/index";
import * as fallbackMailTemplate from "../../generated/templates/login-fallback/index";

const aDate = new Date("1970-01-01");
const aValidPayload: ActivityInput = {
  date_time: aDate,
  name: "foo" as NonEmptyString,
  email: "example@example.com" as EmailString,
  identity_provider: "idp" as NonEmptyString,
  ip_address: "127.0.0.1" as IPString
};
const aValidPayloadWithMagicLink: ActivityInput = {
  ...aValidPayload,
  magic_link: "http://example.com/#token=abcde" as NonEmptyString
};
const emailDefaults: EmailDefaults = {
  from: "from@example.com" as any,
  htmlToTextOptions: {},
  title: "Email title"
};

const mockMailerTransporter = {
  sendMail: jest.fn((_, f) => {
    f(undefined, {});
  })
};

const aHelpDeskRef = "help@desk.com" as NonEmptyString;

const mockTrackEvent = jest.fn();
const mockTracker = ({
  trackEvent: mockTrackEvent
} as unknown) as ai.TelemetryClient;

const templateFunction = jest.spyOn(mailTemplate, "apply");
const fallbackTemplateFunction = jest.spyOn(fallbackMailTemplate, "apply");

describe("SendTemplatedLoginEmailActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each`
    title                     | payload
    ${"fallback login email"} | ${aValidPayload}
    ${"login email"}          | ${aValidPayloadWithMagicLink}
  `("should send a $title with the data", async ({ payload }) => {
    const handler = getSendLoginEmailActivityHandler(
      mockMailerTransporter as any,
      emailDefaults,
      aHelpDeskRef,
      mockTracker
    );

    const result = await handler(context as any, payload);

    expect(result.kind).toEqual("SUCCESS");
    expect(templateFunction).toHaveBeenCalledTimes(payload.magic_link ? 1 : 0);
    expect(fallbackTemplateFunction).toHaveBeenCalledTimes(
      payload.magic_link ? 0 : 1
    );
    expect(mockMailerTransporter.sendMail).toHaveBeenCalledTimes(1);
    expect(mockMailerTransporter.sendMail).toHaveBeenCalledWith(
      {
        from: emailDefaults.from,
        html: expect.any(String),
        subject: emailDefaults.title,
        text: expect.any(String),
        to: aValidPayload.email
      },
      expect.any(Function)
    );
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  });

  it("should fail given wrong payload", async () => {
    const handler = getSendLoginEmailActivityHandler(
      mockMailerTransporter as any,
      emailDefaults,
      aHelpDeskRef,
      mockTracker
    );

    const result = await handler(context as any, {
      ...aValidPayload,
      email: "wrong!"
    });

    expect(result.kind).toEqual("FAILURE");
    expect(mockMailerTransporter.sendMail).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
