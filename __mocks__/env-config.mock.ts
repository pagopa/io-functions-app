import { IConfig } from "../utils/config";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { IntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";

const aBlacklistedFiscalCode = "AAAAAA00A00H501I" as FiscalCode;

export const envConfig = {
  isProduction: false,

  COSMOSDB_KEY: "aKey" as NonEmptyString,
  COSMOSDB_NAME: "aName" as NonEmptyString,
  COSMOSDB_URI: "aUri" as NonEmptyString,
  EUCOVIDCERT_PROFILE_CREATED_QUEUE_NAME: "aQueue" as NonEmptyString,

  FUNCTIONS_PUBLIC_URL: "aaa" as NonEmptyString,
  MESSAGE_CONTAINER_NAME: "aaa" as NonEmptyString,

  PUBLIC_API_KEY: "aaa" as NonEmptyString,
  PUBLIC_API_URL: "aaa" as NonEmptyString,

  EventsQueueStorageConnection: "aaa" as NonEmptyString,
  FN_APP_STORAGE_CONNECTION_STRING: "aaa" as NonEmptyString,
  MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME: "aaa" as NonEmptyString,
  QueueStorageConnection: "aaa" as NonEmptyString,

  SPID_LOGS_PUBLIC_KEY: "aaa" as NonEmptyString,
  SUBSCRIPTIONS_FEED_TABLE: "aaa" as NonEmptyString,

  OPT_OUT_EMAIL_SWITCH_DATE: ("1577836800000" as unknown) as DateFromTimestamp,

  IS_CASHBACK_ENABLED: true,
  FF_NEW_USERS_EUCOVIDCERT_ENABLED: true,
  FF_ONLY_NATIONAL_SERVICES: true,
  FF_OPT_IN_EMAIL_ENABLED: true,

  // MailerConfig
  MAIL_FROM: "aaa" as NonEmptyString,
  MAILHOG_HOSTNAME: "aaa" as NonEmptyString,
  MAILUP_SECRET: "aaa" as NonEmptyString,
  MAILUP_USERNAME: "aaa" as NonEmptyString,

  NODE_ENV: "production",
  REQ_SERVICE_ID: undefined
};
