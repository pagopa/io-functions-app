import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import * as HtmlToText from "html-to-text";
import * as NodeMailer from "nodemailer";

import { Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { EmailString } from "italia-ts-commons/lib/strings";

import { sendMail } from "io-functions-commons/dist/src/utils/email";

import { EmailDefaults } from "./";
import { getEmailHtmlFromTemplate } from "./template";

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
  const { from, title, htmlToTextOptions } = emailDefaults;

  const emailHtml = getEmailHtmlFromTemplate(
    title,
    `${functionsPublicUrl}/validate-profile-email?token=${token}`
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
