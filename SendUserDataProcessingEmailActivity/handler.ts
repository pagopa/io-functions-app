import * as t from "io-ts";

import { Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { left, right } from "fp-ts/lib/Either";
import { fromEither } from "fp-ts/lib/TaskEither";
import { FiscalCode } from "io-functions-commons/dist/generated/definitions/FiscalCode";
import {
  UserDataProcessingChoice,
  UserDataProcessingChoiceEnum
} from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { EmailString } from "italia-ts-commons/lib/strings";
import Mail = require("nodemailer/lib/mailer");
import {
  EmailDefaults,
  findOneProfileByFiscalCodeTaskT,
  sendMailTaskT
} from ".";

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

type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

type ActivityResultFailure = t.TypeOf<typeof ActivityResultFailure>;

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);

export type ActivityResult = t.TypeOf<typeof ActivityResult>;

export const getDpoEmailText = (
  choice: UserDataProcessingChoiceEnum,
  fiscalCode: FiscalCode,
  userEmailAddress: EmailString
) =>
  `Un utente di IO ha inoltrato una nuova richiesta:
tipo richiesta: ${choice}
codice fiscale: ${fiscalCode}
indirizzo email: ${userEmailAddress}.`;

export const getDpoEmailHtml = (subject: string, emailText: string) => `
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width" />
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>${subject}</title>
        </head>
        <body>
          <p>${emailText.replace(/\n/g, "<br>\n")}</p>
        </body>
      </html>`;

export const getDpoEmailSubject = (
  choice: UserDataProcessingChoiceEnum,
  fiscalCode: FiscalCode
) => `IO - Richiesta di tipo ${choice} da parte di ${fiscalCode}`;

const failActivity = (context: Context, logPrefix: string) => (
  errorMessage: string,
  errorDetails?: string
) => {
  const details = errorDetails ? `ERROR_DETAILS=${errorDetails}` : ``;
  context.log.error(`${logPrefix}|${errorMessage}|${details}`);
  return ActivityResultFailure.encode({
    kind: "FAILURE",
    reason: errorMessage
  });
};

const success = () =>
  ActivityResultSuccess.encode({
    kind: "SUCCESS"
  });

/**
 * For each user data procesing request send an email to the DPO
 * containing the information about the user's choice
 * to download or delete his own private data stored by the platform
 */
export const getSendUserDataProcessingEmailActivityHandler = (
  emailDefaults: EmailDefaults,
  sendMail: ReturnType<sendMailTaskT>,
  findOneProfileByFiscalCode: ReturnType<findOneProfileByFiscalCodeTaskT>,
  logPrefix = "SendUserDataProcessingEmail"
) => async (context: Context, input: unknown) => {
  const failure = failActivity(context, logPrefix);
  return fromEither(ActivityInput.decode(input))
    .mapLeft(errs =>
      failure("Error decoding activity input", readableReport(errs))
    )
    .chain(({ choice, fiscalCode }) =>
      findOneProfileByFiscalCode(fiscalCode).foldTaskEither(
        err =>
          fromEither(
            left(failure("Error retrieving user's profile", err.message))
          ),
        maybeRetrievedProfile =>
          maybeRetrievedProfile.fold(
            fromEither(left(failure("No user's profile found"))),
            profile => fromEither(right({ choice, fiscalCode, profile }))
          )
      )
    )
    .chain(({ choice, fiscalCode, profile }) => {
      const subject = getDpoEmailSubject(choice, fiscalCode);
      const emailText = getDpoEmailText(choice, fiscalCode, profile.email);
      const emailHtml = getDpoEmailHtml(subject, emailText);
      return sendMail({
        from: emailDefaults.from,
        html: emailHtml,
        subject,
        text: emailText,
        to: emailDefaults.to
      }).foldTaskEither<ActivityResultFailure, ActivityResultSuccess>(
        err => fromEither(left(failure("Error sending email", err.message))),
        _ => fromEither(right(success()))
      );
    })
    .run();
};
