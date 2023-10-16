import { Context } from "@azure/functions";
import {
  EmailString,
  IPString,
  NonEmptyString
} from "@pagopa/ts-commons/lib/strings";
import * as NodeMailer from "nodemailer";
import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as O from "fp-ts/lib/Option";
import { pipe } from "fp-ts/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as HtmlToText from "html-to-text";
import { sendMail } from "@pagopa/io-functions-commons/dist/src/mailer";
import * as ai from "applicationinsights";
import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import * as mailTemplate from "../generated/templates/login/index";
import * as fallbackMailTemplate from "../generated/templates/login-fallback/index";
import { EmailDefaults } from "./index";

// Activity input
export const ActivityInput = t.intersection([
  t.interface({
    date_time: DateFromTimestamp,
    email: EmailString,
    identity_provider: NonEmptyString,
    ip_address: IPString,
    name: NonEmptyString
  }),
  t.partial({
    device_name: NonEmptyString,
    geo_location: NonEmptyString,
    magic_link: NonEmptyString
  })
]);

export type ActivityInput = t.TypeOf<typeof ActivityInput>;

// Activity result
export const ActivityResultSuccess = t.interface({
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

const logPrefix = "SendTemplatedLoginEmailActivity";

export const getSendLoginEmailActivityHandler = (
  mailerTransporter: NodeMailer.Transporter,
  emailDefaults: EmailDefaults,
  helpDeskRef: NonEmptyString,
  telemetryClient?: ai.TelemetryClient
) => async (context: Context, input: unknown): Promise<ActivityResult> =>
  pipe(
    input,
    ActivityInput.decode,
    E.mapLeft(errors => {
      context.log.error(
        `${logPrefix}|Error while decoding input|ERROR=${readableReportSimplified(
          errors
        )}`
      );

      return ActivityResultFailure.encode({
        kind: "FAILURE",
        reason: "Error while decoding input"
      });
    }),
    E.bindTo("activityInput"),
    E.bind("maybeMagicLink", ({ activityInput }) =>
      pipe(activityInput.magic_link, O.fromNullable, E.of)
    ),
    E.bind("emailHtml", ({ activityInput, maybeMagicLink }) =>
      pipe(
        maybeMagicLink,
        O.fold(
          // if we could not obtain the magic link, send a
          // fallback email with assistance reference
          () =>
            E.of(
              fallbackMailTemplate.apply(
                activityInput.name,
                activityInput.identity_provider,
                activityInput.date_time,
                (activityInput.ip_address as unknown) as NonEmptyString,
                helpDeskRef
              )
            ),
          magic_link =>
            E.of(
              mailTemplate.apply(
                activityInput.name,
                activityInput.identity_provider,
                activityInput.date_time,
                (activityInput.ip_address as unknown) as NonEmptyString,
                magic_link
              )
            )
        )
      )
    ),
    E.bind("emailText", ({ emailHtml }) =>
      E.of(HtmlToText.fromString(emailHtml, emailDefaults.htmlToTextOptions))
    ),
    TE.fromEither,
    TE.chain(({ activityInput, emailHtml, emailText }) =>
      pipe(
        sendMail(mailerTransporter, {
          from: emailDefaults.from,
          html: emailHtml,
          subject: emailDefaults.title,
          text: emailText,
          to: activityInput.email
        }),
        TE.mapLeft(error => {
          const formattedError = Error(
            `${logPrefix}|Error sending validation email|ERROR=${error.message}`
          );
          context.log.error(formattedError.message);
          // we want to start a retry
          throw formattedError;
        }),
        TE.map(result => {
          const info = result.value;

          // track custom event after the email was sent
          if (telemetryClient) {
            telemetryClient.trackEvent({
              name: `SendTemplatedLoginEmailActivity.success`,
              properties: info
            });
          }
        })
      )
    ),
    TE.map(_ => ActivityResultSuccess.encode({ kind: "SUCCESS" })),
    TE.toUnion
  )();
