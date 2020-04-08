import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import * as NodeMailer from "nodemailer";

import { Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { EmailString } from "italia-ts-commons/lib/strings";

import { sendMail } from "io-functions-commons/dist/src/utils/email";

import { FiscalCode } from "io-functions-commons/dist/generated/definitions/FiscalCode";
import { UserDataProcessingChoice } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { EmailDefaults } from ".";

// Activity input
export const ActivityInput = t.interface({
  choice: UserDataProcessingChoice,
  email: EmailString,
  fiscalCode: FiscalCode
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

export const getSendUserDataProcessingEmailActivityHandler = (
  mailerTransporter: NodeMailer.Transporter,
  emailDefaults: EmailDefaults
) => async (context: Context, input: unknown): Promise<unknown> => {
  const logPrefix = "SendUserDataProcessingEmail";

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
  const { choice, email, fiscalCode } = activityInput;

  const { from, title, to } = emailDefaults;

  // prepare the text version of the message
  const emailText = `Con la presente si informa che e' stata effettuata la richiesta di:
                    ${choice.toString()} dall' utente con codice fiscale ${fiscalCode}.
                    L' indirizzo e-mail dell' utente e' ${email}`;

  // Send email to DPO with information about user's will to down load or delete its own data
  const errorOrSentMessageInfo = await sendMail(mailerTransporter, {
    from,
    subject: title,
    text: emailText,
    to
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
