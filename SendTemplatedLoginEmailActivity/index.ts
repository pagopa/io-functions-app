import { getMailerTransporter } from "@pagopa/io-functions-commons/dist/src/mailer";
import { initTelemetryClient } from "../utils/appinsights";
import { getConfigOrThrow } from "../utils/config";
import { getSendLoginEmailActivityHandler } from "./handler";

const config = getConfigOrThrow();

// Email data
const EMAIL_TITLE = "È stato eseguito l'accesso sull'app IO";

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
const telemetryClient = initTelemetryClient();

const activityFunctionHandler = getSendLoginEmailActivityHandler(
  mailerTransporter,
  emailDefaults,
  config.IOWEB_ACCESS_REF,
  telemetryClient
);

export default activityFunctionHandler;
