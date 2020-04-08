import * as NodeMailer from "nodemailer";

import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";

import { MailUpTransport } from "io-functions-commons/dist/src/utils/mailup";

import { getSendUserDataProcessingEmailActivityHandler } from "./handler";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Mailup
const mailupUsername = getRequiredStringEnv("MAILUP_USERNAME");
const mailupSecret = getRequiredStringEnv("MAILUP_SECRET");

// Email data
const EMAIL_TITLE = "IO - Richiesta di Download/Cancellazione Dati Utente";
const mailFrom = getRequiredStringEnv("MAIL_FROM");
const dpoMailTo = getRequiredStringEnv("DPO_MAIL_TO");

const emailDefaults = {
  from: mailFrom,
  title: EMAIL_TITLE,
  to: dpoMailTo
};

export type EmailDefaults = typeof emailDefaults;

// For development we use mailhog to intercept emails
// Use the `docker-compose.yml` file to run the mailhog server
const mailerTransporter = isProduction
  ? NodeMailer.createTransport(
      MailUpTransport({
        creds: {
          Secret: mailupSecret,
          Username: mailupUsername
        }
      })
    )
  : NodeMailer.createTransport({
      host: "localhost",
      port: 1025,
      secure: false
    });

const activityFunctionHandler = getSendUserDataProcessingEmailActivityHandler(
  mailerTransporter,
  emailDefaults
);

export default activityFunctionHandler;
