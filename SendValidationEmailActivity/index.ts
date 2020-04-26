import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";

import { getSendValidationEmailActivityHandler } from "./handler";

import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { getMailerTransporter } from "../utils/email";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Optional SendGrid key
const sendgridApiKey = NonEmptyString.decode(
  process.env.SENDGRID_API_KEY
).getOrElse(undefined);

// Mailup
const mailupUsername = getRequiredStringEnv("MAILUP_USERNAME");
const mailupSecret = getRequiredStringEnv("MAILUP_SECRET");

// Email data
const EMAIL_TITLE = "Valida l’indirizzo email che usi su IO";
const mailFrom = getRequiredStringEnv("MAIL_FROM");

// Needed to construct the email validation url
const functionsPublicUrl = getRequiredStringEnv("FUNCTIONS_PUBLIC_URL");

const HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  ignoreImage: true, // Ignore all document images
  tables: true
};

const emailDefaults = {
  from: mailFrom,
  htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
  title: EMAIL_TITLE
};

export type EmailDefaults = typeof emailDefaults;

const mailerTransporter = getMailerTransporter({
  isProduction,
  ...(sendgridApiKey ? { sendgridApiKey } : { mailupSecret, mailupUsername })
});

const activityFunctionHandler = getSendValidationEmailActivityHandler(
  mailerTransporter,
  emailDefaults,
  functionsPublicUrl
);

export default activityFunctionHandler;
