import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import * as HtmlToText from "html-to-text";
import * as NodeMailer from "nodemailer";

import { Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { EmailString } from "italia-ts-commons/lib/strings";

import defaultHtmlTemplate from "io-functions-commons/dist/src/templates/html/default";
import { sendMail } from "io-functions-commons/dist/src/utils/email";

import { EmailDefaults } from "./";

export function generateValidationEmailContentHtml(
  emailValidationFunctionUrl: string,
  token: string
): string {
  // TODO: Add a better validation email content
  // https://www.pivotaltracker.com/story/show/169808317
  return `
  <p>Click <a href="${emailValidationFunctionUrl}?token=${token}">here</a> to validate your email.</p>
  `;
}

// Activity input
export const ActivityInput = t.interface({
  email: EmailString,
  token: t.string
});

export type ActivityInput = t.TypeOf<typeof ActivityInput>;

// Activity result
const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);

export type ActivityResult = t.TypeOf<typeof ActivityResult>;

export const getSendValidationEmailActivityHandler = (
  mailerTransporter: NodeMailer.Transporter,
  emailDefaults: EmailDefaults,
  functionsPublicUrl: string
) => async (context: Context, input: unknown): Promise<unknown> => {
  const logPrefix = "SendValidationEmailActivity";

  const errorOrActivityInput = ActivityInput.decode(input);

  if (isLeft(errorOrActivityInput)) {
    context.log.error(
      `${logPrefix}|Error decoding input|ERROR=${readableReport(
        errorOrActivityInput.value
      )}`
    );
    return ActivityResultFailure.encode({
      kind: "FAILURE",
      reason: "Error decoding input"
    });
  }

  const activityInput = errorOrActivityInput.value;
  const { email, token } = activityInput;

  // Generate the email html from the template
  const {
    from,
    title,
    senderOrganizationName,
    senderService,
    organizationFiscalCode,
    htmlToTextOptions
  } = emailDefaults;

  const emailHtml = defaultHtmlTemplate(
    title,
    "",
    senderOrganizationName,
    senderService,
    organizationFiscalCode,
    title,
    generateValidationEmailContentHtml(
      `${functionsPublicUrl}/validate-profile-email`,
      token
    ),
    ""
  );

  // converts the HTML to pure text to generate the text version of the message
  const emailText = HtmlToText.fromString(emailHtml, htmlToTextOptions);

  // Send email with the validation link
  const errorOrSentMessageInfo = await sendMail(mailerTransporter, {
    from,
    html: emailHtml,
    subject: title,
    text: emailText,
    to: email
  });

  if (isLeft(errorOrSentMessageInfo)) {
    const error = Error(
      `${logPrefix}|Error sending validation email|ERROR=${errorOrSentMessageInfo.value.message}`
    );
    context.log.error(error.message);
    throw error;
  }

  return ActivityResultSuccess.encode({
    kind: "SUCCESS"
  });
};
