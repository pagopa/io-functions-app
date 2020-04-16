import * as t from "io-ts";

import { isLeft, isRight } from "fp-ts/lib/Either";

import * as NodeMailer from "nodemailer";

import { Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { sendMail } from "io-functions-commons/dist/src/utils/email";

import { isSome } from "fp-ts/lib/Option";
import { FiscalCode } from "io-functions-commons/dist/generated/definitions/FiscalCode";
import { UserDataProcessingChoice } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { ProfileModel } from "io-functions-commons/dist/src/models/profile";
import { EmailDefaults } from ".";

// Activity input
export const ActivityInput = t.interface({
  choice: UserDataProcessingChoice,
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
  emailDefaults: EmailDefaults,
  profileModel: ProfileModel
) => async (context: Context, input: unknown) => {
  const logPrefix = "SendUserDataProcessingEmail";

  const errorOrActivityInput = ActivityInput.decode(input);

  if (isLeft(errorOrActivityInput)) {
    context.log.error(
      `${logPrefix}|Error decoding SendUserDataProcessingActivity input`
    );
    context.log.verbose(
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
  const { choice, fiscalCode } = activityInput;

  const errorOrMaybeRetrievedProfile = await profileModel.findOneProfileByFiscalCode(
    fiscalCode
  );
  if (isRight(errorOrMaybeRetrievedProfile)) {
    const maybeRetrievedProfile = errorOrMaybeRetrievedProfile.value;
    if (isSome(maybeRetrievedProfile)) {
      const { from, to } = emailDefaults;
      const subject = `IO - Richiesta di tipo ${choice} da parte di ${fiscalCode}`;
      const userEmailAddress = maybeRetrievedProfile.value.email;
      // prepare the text version of the message
      const emailText = `Un utente di IO ha inoltrato una nuova richiesta:
  tipo richiesta: ${choice}
  codice fiscale: ${fiscalCode}
  indirizzo email: ${userEmailAddress}.`;

      // Send an email to the DPO containing the information about the IO user's
      // choice to download or delete his own private data stored by the platform
      const errorOrSentMessageInfo = await sendMail(mailerTransporter, {
        from,
        subject,
        text: emailText,
        to
      });

      if (isLeft(errorOrSentMessageInfo)) {
        context.log.error(
          `${logPrefix}|Error sending validation email|ERROR=${errorOrSentMessageInfo.value.message}`
        );
        return ActivityResultFailure.encode({
          kind: "FAILURE",
          reason: "Error while sending mail"
        });
      }

      return ActivityResultSuccess.encode({
        kind: "SUCCESS"
      });
    }
  } else {
    context.log.error(
      `${logPrefix}|Error retrieving user's profile|ERROR=${errorOrMaybeRetrievedProfile.value}`
    );
    return ActivityResultFailure.encode({
      kind: "FAILURE",
      reason: "Error while retrieving user's profile"
    });
  }
};
