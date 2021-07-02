/**
 * Config module
 *
 * Single point of access for the application confguration. Handles validation on required environment variables.
 * The configuration is evaluate eagerly at the first access to the module. The module exposes convenient methods to access such value.
 */

import { fromNullable as fromNullableE } from "fp-ts/lib/Either";
import { fromNullable } from "fp-ts/lib/Option";
import * as t from "io-ts";

import { MailerConfig } from "@pagopa/io-functions-commons/dist/src/mailer";

import { UTCISODateFromString } from "@pagopa/ts-commons/lib/dates";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { identity } from "fp-ts/lib/function";

// exclude a specific value from a type
// as strict equality is performed, allowed input types are constrained to be values not references (object, arrays, etc)
// tslint:disable-next-line max-union-size
const AnyBut = <A extends string | number | boolean | symbol, O = A>(
  but: A,
  base: t.Type<A, O> = t.any
) =>
  t.brand(
    base,
    (
      s
    ): s is t.Branded<
      t.TypeOf<typeof base>,
      { readonly AnyBut: unique symbol }
    > => s !== but,
    "AnyBut"
  );

// configuration for REQ_SERVICE_ID in dev
export type ReqServiceIdConfig = t.TypeOf<typeof ReqServiceIdConfig>;
export const ReqServiceIdConfig = t.union([
  t.interface({
    NODE_ENV: t.literal("production"),
    REQ_SERVICE_ID: t.undefined
  }),
  t.interface({
    NODE_ENV: AnyBut("production", t.string),
    REQ_SERVICE_ID: NonEmptyString
  })
]);

export const EUCovidCertProfileQueueConfig = t.union([
  t.interface({
    EUCOVIDCERT_PROFILE_CREATED_QUEUE_NAME: NonEmptyString,
    FF_NEW_USERS_EUCOVIDCERT_ENABLED: t.literal(true)
  }),
  t.interface({ FF_NEW_USERS_EUCOVIDCERT_ENABLED: t.literal(false) })
]);
export type EUCovidCertProfileQueueConfig = t.TypeOf<
  typeof EUCovidCertProfileQueueConfig
>;

// global app configuration
export type IConfig = t.TypeOf<typeof IConfig>;
export const IConfig = t.intersection([
  t.interface({
    COSMOSDB_KEY: NonEmptyString,
    COSMOSDB_NAME: NonEmptyString,
    COSMOSDB_URI: NonEmptyString,

    FUNCTIONS_PUBLIC_URL: NonEmptyString,

    MESSAGE_CONTAINER_NAME: NonEmptyString,

    PUBLIC_API_KEY: NonEmptyString,
    PUBLIC_API_URL: NonEmptyString,

    EventsQueueStorageConnection: NonEmptyString,
    QueueStorageConnection: NonEmptyString,

    SPID_LOGS_PUBLIC_KEY: NonEmptyString,
    SUBSCRIPTIONS_FEED_TABLE: NonEmptyString,

    EMAIL_MODE_SWITCH_LIMIT_DATE: UTCISODateFromString,

    IS_CASHBACK_ENABLED: t.boolean,

    FF_NEW_USERS_EUCOVIDCERT_ENABLED: t.boolean,
    FF_ONLY_NATIONAL_SERVICES: t.boolean,

    isProduction: t.boolean
  }),
  MailerConfig,
  ReqServiceIdConfig,
  EUCovidCertProfileQueueConfig
]);

const DEFAULT_EMAIL_MODE_SWITCH_LIMIT_DATE = new Date("1970-01-01T00:00:00Z");

// No need to re-evaluate this object for each call
const errorOrConfig: t.Validation<IConfig> = IConfig.decode({
  ...process.env,
  EMAIL_MODE_SWITCH_LIMIT_DATE: fromNullableE(
    DEFAULT_EMAIL_MODE_SWITCH_LIMIT_DATE
  )(process.env.EMAIL_MODE_SWITCH_LIMIT_DATE)
    .chain(_ =>
      UTCISODateFromString.decode(_).mapLeft(
        () => DEFAULT_EMAIL_MODE_SWITCH_LIMIT_DATE
      )
    )
    .fold(identity, identity),
  FF_NEW_USERS_EUCOVIDCERT_ENABLED: fromNullable(
    process.env.FF_NEW_USERS_EUCOVIDCERT_ENABLED
  )
    .map(_ => _.toLocaleLowerCase() === "true")
    .getOrElse(false),
  FF_ONLY_NATIONAL_SERVICES: fromNullable(process.env.FF_ONLY_NATIONAL_SERVICES)
    .map(_ => _.toLocaleLowerCase() === "true")
    .getOrElse(false),
  IS_CASHBACK_ENABLED: fromNullable(process.env.IS_CASHBACK_ENABLED)
    .map(_ => _.toLocaleLowerCase() === "true")
    .getOrElse(false),
  isProduction: process.env.NODE_ENV === "production"
});

/**
 * Read the application configuration and check for invalid values.
 * Configuration is eagerly evalued when the application starts.
 *
 * @returns either the configuration values or a list of validation errors
 */
export function getConfig(): t.Validation<IConfig> {
  return errorOrConfig;
}

/**
 * Read the application configuration and check for invalid values.
 * If the application is not valid, raises an exception.
 *
 * @returns the configuration values
 * @throws validation errors found while parsing the application configuration
 */
export function getConfigOrThrow(): IConfig {
  return errorOrConfig.getOrElseL(errors => {
    throw new Error(`Invalid configuration: ${readableReport(errors)}`);
  });
}
