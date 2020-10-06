import { MailMultiTransportConnectionsFromString } from "io-functions-commons/dist/src/utils/multi_transport_connection";
import { MultiTransport } from "io-functions-commons/dist/src/utils/nodemailer";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

import * as NodeMailer from "nodemailer";

import { getSendValidationEmailActivityHandler } from "./handler";

import {
  getMailerTransporter,
  getTransportsForConnections
} from "../utils/email";

import { initTelemetryClient } from "../utils/appinsights";

import { getConfigOrThrow } from "../utils/config";

const config = getConfigOrThrow();

// Whether we're in a production environment
const isProduction = config.NODE_ENV === "production";

// Optional SendGrid key
const sendgridApiKey = NonEmptyString.decode(
  config.SENDGRID_API_KEY
).getOrElse(undefined);

// Mailup
const mailupUsername = config.MAILUP_USERNAME;
const mailupSecret = config.MAILUP_SECRET;

// Email data
const EMAIL_TITLE = "Valida l’indirizzo email che usi su IO";
const mailFrom = config.MAIL_FROM;

// Needed to construct the email validation url
const functionsPublicUrl = config.FUNCTIONS_PUBLIC_URL;

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

// Optional multi provider connection string
// The connection string must be in the format:
//   [mailup:username:password;][sendgrid:apikey:;]
// Note that multiple instances of the same provider can be provided.
const transports = MailMultiTransportConnectionsFromString.decode(
  config.MAIL_TRANSPORTS
)
  .map(getTransportsForConnections)
  .getOrElse([]);

// if we have a valid multi transport configuration, configure a
// Multi transport, or else fall back to the default logic
const mailerTransporter =
  transports.length > 0
    ? NodeMailer.createTransport(
        MultiTransport({
          transports
        })
      )
    : getMailerTransporter({
        isProduction,
        ...(sendgridApiKey
          ? { sendgridApiKey }
          : { mailupSecret, mailupUsername })
      });

// Initialize application insights
initTelemetryClient();

const activityFunctionHandler = getSendValidationEmailActivityHandler(
  mailerTransporter,
  emailDefaults,
  functionsPublicUrl
);

export default activityFunctionHandler;
