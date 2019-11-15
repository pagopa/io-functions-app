﻿import * as NodeMailer from "nodemailer";

import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";

import { MailUpTransport } from "io-functions-commons/dist/src/utils/mailup";

import { getSendValidationEmailActivityHandler } from "./handler";

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Mailup
const mailupUsername = getRequiredStringEnv("MAILUP_USERNAME");
const mailupSecret = getRequiredStringEnv("MAILUP_SECRET");

// Email data
const EMAIL_TITLE = "Email validation";
const mailFrom = getRequiredStringEnv("MAIL_FROM");
const mailOrganizationFiscalCode = getRequiredStringEnv(
  "MAIL_ORGANIZATION_FISCALCODE"
);
const mailOrganizationName = getRequiredStringEnv("MAIL_ORGANIZATION_NAME");
const mailSenderService = getRequiredStringEnv("MAIL_SENDER_SERVICE");

// Needed to construct the email validation url
const functionsPublicUrl = getRequiredStringEnv("FUNCTIONS_PUBLIC_URL");

const HTML_TO_TEXT_OPTIONS: HtmlToTextOptions = {
  ignoreImage: true, // Ignore all document images
  tables: true
};

const emailDefaults = {
  from: mailFrom,
  htmlToTextOptions: HTML_TO_TEXT_OPTIONS,
  organizationFiscalCode: mailOrganizationFiscalCode,
  senderOrganizationName: mailOrganizationName,
  senderService: mailSenderService,
  title: EMAIL_TITLE
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

const activityFunctionHandler = getSendValidationEmailActivityHandler(
  mailerTransporter,
  emailDefaults,
  functionsPublicUrl
);

export default activityFunctionHandler;
