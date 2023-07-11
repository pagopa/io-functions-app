import { getSendLoginEmailActivityHandler } from "../handler";
import { context } from "../../__mocks__/durable-functions";
import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { EmailDefaults } from "../index";

const aDate = new Date("1970-01-01");
const aValidPayload = {
  date_time: aDate,
  name: "foo" as NonEmptyString,
  email: "example@example.com" as EmailString,
  identity_provider: "idp" as NonEmptyString,
  ip_address: "1.1.1.1" as NonEmptyString
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

const aPublicUrl = "https://localhost/" as NonEmptyString;

const mockTrackEvent = jest.fn();
jest.mock("applicationinsights", () => ({
  defaultClient: {
    trackEvent: () => mockTrackEvent()
  }
}));
describe("SendTemplatedLoginEmailActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should send a login email with the data", async () => {
    const handler = getSendLoginEmailActivityHandler(
      mockMailerTransporter as any,
      emailDefaults,
      aPublicUrl
    );

    const result = await handler(context as any, aValidPayload);

    expect(result.kind).toEqual("SUCCESS");
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
      aPublicUrl
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
