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
import { pipe } from "fp-ts/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import * as HtmlToText from "html-to-text";
import { sendMail } from "@pagopa/io-functions-commons/dist/src/mailer";
import * as ai from "applicationinsights";
import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import * as mailTemplate from "../generated/templates/login/index";
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
    magic_code: NonEmptyString
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
  _magicLinkServicePublicUrl: NonEmptyString,
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
    E.bind("emailHtml", ({ activityInput }) =>
      E.of(
        mailTemplate.apply(
          activityInput.name,
          activityInput.identity_provider,
          activityInput.date_time,
          (activityInput.ip_address as unknown) as NonEmptyString,
          helpDeskRef
          // TODO: with version2 of the template,pass the magic_code and publicUrl
          // activityInput.magic_code,
          // magicLinkServicePublicUrl,
        )
      )
    ),
    E.bind("emailText", ({ emailHtml }) =>
      E.of(HtmlToText.fromString(emailHtml, emailDefaults.htmlToTextOptions))
    ),
    TE.fromEither,
    TE.chainW(({ activityInput, emailHtml, emailText }) =>
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
