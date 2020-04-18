import * as NodeMailer from "nodemailer";
import Mail = require("nodemailer/lib/mailer");

import { toError } from "fp-ts/lib/Either";
import { Option } from "fp-ts/lib/Option";
import { Task } from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import {
  PROFILE_COLLECTION_NAME,
  ProfileModel,
  RetrievedProfile
} from "io-functions-commons/dist/src/models/profile";
import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { MailUpTransport } from "io-functions-commons/dist/src/utils/mailup";
import { FiscalCode } from "italia-ts-commons/lib/strings";
import { getDocumentClient } from "../utils/cosmosdb";
import { getSendUserDataProcessingEmailActivityHandler } from "./handler";

const cosmosDbUri = getRequiredStringEnv("COSMOSDB_URI");
const cosmosDbKey = getRequiredStringEnv("COSMOSDB_KEY");
const cosmosDbName = getRequiredStringEnv("COSMOSDB_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);

const profilesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  PROFILE_COLLECTION_NAME
);

const documentClient = getDocumentClient(cosmosDbUri, cosmosDbKey);

const profileModel = new ProfileModel(documentClient, profilesCollectionUrl);

const findOneProfileByFiscalCodeTask = (pm: ProfileModel) => (
  fiscalCode: FiscalCode
) =>
  TE.tryCatch(
    () => pm.findOneProfileByFiscalCode(fiscalCode),
    toError
  ).foldTaskEither<Error, Option<RetrievedProfile>>(
    err => TE.left(new Task(async () => err)),
    queryErrorOrMaybeProfile =>
      queryErrorOrMaybeProfile.fold(
        queryError => TE.left(new Task(async () => new Error(queryError.body))),
        maybeProfile => TE.right(new Task(async () => maybeProfile))
      )
  );

export type findOneProfileByFiscalCodeTaskT = typeof findOneProfileByFiscalCodeTask;

// Whether we're in a production environment
const isProduction = process.env.NODE_ENV === "production";

// Mailup
const mailupUsername = getRequiredStringEnv("MAILUP_USERNAME");
const mailupSecret = getRequiredStringEnv("MAILUP_SECRET");

// Email data
const mailFrom = getRequiredStringEnv("MAIL_FROM");
const dpoMailTo = getRequiredStringEnv("DPO_EMAIL_ADDRESS");

const emailDefaults = {
  from: mailFrom,
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

const sendMailTask = (mt: Mail) => (
  options: Mail.Options & { html: Mail.Options["html"] }
) => TE.tryCatch(() => mt.sendMail(options), toError);

export type sendMailTaskT = typeof sendMailTask;

const activityFunctionHandler = getSendUserDataProcessingEmailActivityHandler(
  emailDefaults,
  sendMailTask(mailerTransporter),
  findOneProfileByFiscalCodeTask(profileModel)
);

export default activityFunctionHandler;
