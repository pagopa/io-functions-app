import { getSendValidationEmailActivityHandler } from "./handler";

            // eslint-disable-next-line import/order
import { initTelemetryClient } from "../utils/appinsights";

            // eslint-disable-next-line import/order
import { getConfigOrThrow } from "../utils/config";

            // eslint-disable-next-line import/order
import { getMailerTransporter } from "@pagopa/io-functions-commons/dist/src/mailer";

const config = getConfigOrThrow();

// Email data
const EMAIL_TITLE = "Valida l’indirizzo email che usi su IO";

const HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  ignoreImage: true, // Ignore all document images
  tables: true
};

const emailDefaults = {
  from: config.MAIL_FROM,
  htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
  title: EMAIL_TITLE
};

export type EmailDefaults = typeof emailDefaults;

const mailerTransporter = getMailerTransporter(config);

// Initialize application insights
initTelemetryClient();

const activityFunctionHandler = getSendValidationEmailActivityHandler(
  mailerTransporter,
  emailDefaults,
  config.FUNCTIONS_PUBLIC_URL
);

export default activityFunctionHandler;
