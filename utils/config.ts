/**
 * Config module
 *
 * Single point of access for the application confguration. Handles validation on required environment variables.
 * The configuration is evaluate eagerly at the first access to the module. The module exposes convenient methods to access such value.
 */

import * as t from "io-ts";

import * as E from "fp-ts/lib/Either";
import { flow, pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";

import { MailerConfig } from "@pagopa/io-functions-commons/dist/src/mailer";

import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import { NumberFromString } from "@pagopa/ts-commons/lib/numbers";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import {
  VISIBLE_SERVICE_BLOB_ID,
  VISIBLE_SERVICE_CONTAINER
} from "@pagopa/io-functions-commons/dist/src/models/visible_service";
import { JsonFromString, withFallback } from "io-ts-types";
import { UrlFromString } from "@pagopa/ts-commons/lib/url";
import { FeatureFlag, FeatureFlagEnum } from "./featureFlag";

// exclude a specific value from a type
// as strict equality is performed, allowed input types are constrained to be values not references (object, arrays, etc)
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const AnyBut = <A extends string | number | boolean | symbol, Out = A>(
  but: A,
  base: t.Type<A, Out> = t.any
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

export type VisibleServiceConfig = t.TypeOf<typeof VisibleServiceConfig>;
export const VisibleServiceConfig = t.interface({
  VISIBLE_SERVICE_BLOB_ID: withDefault(
    NonEmptyString,
    VISIBLE_SERVICE_BLOB_ID as NonEmptyString
  ),
  VISIBLE_SERVICE_CONTAINER: withDefault(
    NonEmptyString,
    VISIBLE_SERVICE_CONTAINER as NonEmptyString
  )
});

export const BetaUsers = t.readonlyArray(FiscalCode);
export type BetaUsers = t.TypeOf<typeof BetaUsers>;

export const BetaUsersFromString = t.string.pipe(
  withFallback(JsonFromString, []).pipe(BetaUsers)
);
export const FeatureFlagFromString = withFallback(
  FeatureFlag,
  FeatureFlagEnum.NONE
);

// global app configuration
export type IConfig = t.TypeOf<typeof IConfig>;
export const IConfig = t.intersection([
  t.type({
    BETA_USERS: BetaUsersFromString,

    COSMOSDB_CONNECTION_STRING: NonEmptyString,
    COSMOSDB_KEY: NonEmptyString,
    COSMOSDB_NAME: NonEmptyString,
    COSMOSDB_URI: NonEmptyString,

    FUNCTIONS_PUBLIC_URL: NonEmptyString,

    // url mentioned in the fallback login email
    IOWEB_ACCESS_REF: UrlFromString,

    MAGIC_LINK_SERVICE_API_KEY: NonEmptyString,
    MAGIC_LINK_SERVICE_PUBLIC_URL: NonEmptyString,

    MESSAGE_CONTAINER_NAME: NonEmptyString,

    ON_PROFILE_UPDATE_LEASES_PREFIX: NonEmptyString,

    PUBLIC_API_KEY: NonEmptyString,
    PUBLIC_API_URL: NonEmptyString,

    // eslint-disable-next-line sort-keys
    EventsQueueName: NonEmptyString,
    EventsQueueStorageConnection: NonEmptyString,
    FN_APP_STORAGE_CONNECTION_STRING: NonEmptyString,
    MIGRATE_SERVICES_PREFERENCES_PROFILE_QUEUE_NAME: NonEmptyString,
    QueueStorageConnection: NonEmptyString,

    SPID_LOGS_PUBLIC_KEY: NonEmptyString,
    SUBSCRIPTIONS_FEED_TABLE: NonEmptyString,

    // eslint-disable-next-line sort-keys
    OPT_OUT_EMAIL_SWITCH_DATE: DateFromTimestamp,

    // eslint-disable-next-line sort-keys
    IS_CASHBACK_ENABLED: t.boolean,

    // eslint-disable-next-line sort-keys
    FF_ONLY_NATIONAL_SERVICES: t.boolean,

    PROFILE_EMAIL_STORAGE_CONNECTION_STRING: NonEmptyString,
    PROFILE_EMAIL_STORAGE_TABLE_NAME: NonEmptyString,

    isProduction: t.boolean
  }),
  MailerConfig,
  ReqServiceIdConfig,
  VisibleServiceConfig
]);

// Default value is expressed as a Unix timestamp so it can be safely compared with Cosmos timestamp
// This means that Date representation is in the past compared to the effectively switch Date we want to set
const DEFAULT_OPT_OUT_EMAIL_SWITCH_DATE = 1625781600;

// get a boolen value from string
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getBooleanOrFalse = (value?: string) =>
  pipe(
    value,
    O.fromNullable,
    O.map(_ => _.toLocaleLowerCase() === "true"),
    O.getOrElse(() => false)
  );

// No need to re-evaluate this object for each call
const errorOrConfig: t.Validation<IConfig> = IConfig.decode({
  ...process.env,
  FF_ONLY_NATIONAL_SERVICES: getBooleanOrFalse(
    process.env.FF_ONLY_NATIONAL_SERVICES
  ),
  IS_CASHBACK_ENABLED: getBooleanOrFalse(process.env.IS_CASHBACK_ENABLED),
  OPT_OUT_EMAIL_SWITCH_DATE: pipe(
    E.fromNullable(DEFAULT_OPT_OUT_EMAIL_SWITCH_DATE)(
      process.env.OPT_OUT_EMAIL_SWITCH_DATE
    ),
    E.chain(
      flow(
        NumberFromString.decode,
        E.mapLeft(() => DEFAULT_OPT_OUT_EMAIL_SWITCH_DATE)
      )
    ),
    E.toUnion
  ),
  isProduction: process.env.NODE_ENV === "production"
});

/**
 * Read the application configuration and check for invalid values.
 * Configuration is eagerly evalued when the application starts.
 *
 * @returns either the configuration values or a list of validation errors
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
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
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function getConfigOrThrow(): IConfig {
  return pipe(
    errorOrConfig,
    E.getOrElseW(errors => {
      throw new Error(`Invalid configuration: ${readableReport(errors)}`);
    })
  );
}
