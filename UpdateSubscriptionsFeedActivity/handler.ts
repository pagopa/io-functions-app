import { Context } from "@azure/functions";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { TableService } from "azure-storage";
import * as crypto from "crypto";
import * as t from "io-ts";
import { updateSubscriptionStatus } from "../utils/subscription_feed";

/**
 * Input data for this activity function, we need information about the kind
 * of subscription event and the affected user profile.
 */
const Input = t.intersection([
  t.interface({
    // fiscal code of the user affected by this update
    fiscalCode: FiscalCode,
    // whether the service has been subscribed or unsubscribed
    operation: t.union([t.literal("SUBSCRIBED"), t.literal("UNSUBSCRIBED")]),
    // the time (millis epoch) of the update
    updatedAt: t.number,
    // updated version of the profile
    version: t.number
  }),
  t.union([
    t.interface({
      // a profile subscription event
      subscriptionKind: t.literal("PROFILE")
    }),
    t.interface({
      // the updated service
      serviceId: ServiceId,
      // a service subscription event
      subscriptionKind: t.literal("SERVICE")
    })
  ])
]);

export type Input = t.TypeOf<typeof Input>;

export const updateSubscriptionFeed = async (
  context: Context,
  rawInput: unknown,
  tableService: TableService,
  subscriptionFeedTableName: NonEmptyString,
  logPrefix: string = "UpdateServiceSubscriptionFeedActivity"
) => {
  const decodedInputOrError = Input.decode(rawInput);
  if (decodedInputOrError.isLeft()) {
    context.log.error(
      `${logPrefix}|Cannot parse input|ERROR=${readableReport(
        decodedInputOrError.value
      )}`
    );
    return "FAILURE";
  }

  const decodedInput = decodedInputOrError.value;

  const { fiscalCode, operation, updatedAt, version } = decodedInput;

  // The date part of the key will be in UTC time zone, with format: YYYY-MM-DD
  const utcTodayPrefix = new Date(updatedAt).toISOString().substring(0, 10);

  // Create a SHA256 hash of the fiscal code
  // see https://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm_options
  const fiscalCodeHash = crypto
    .createHash("sha256")
    .update(fiscalCode)
    .digest("hex");

  const updateLogPrefix = `${logPrefix}|PROFILE=${fiscalCode}|OPERATION=${operation}|PROFILE=${fiscalCode}`;

  // Entity keys have the following format
  //
  // Profile subscription events: P-<DATE>-<EVENT>-<HASH>
  // Service subscription events: S-<DATE>-<SERVICE_ID>-<EVENT>-<HASH>
  //
  // Where:
  //
  // * DATE is "YYYY-MM-DD" (UTC)
  // * SERVICE_ID is the service ID that the user subscribed/unsubscribed
  // * EVENT is either "S" for subscription events or "U" for unsubscriptions
  // * HASH is the hex encoded SHA256 hash of the fiscal code
  //
  const sPartitionKey =
    decodedInput.subscriptionKind === "PROFILE"
      ? `P-${utcTodayPrefix}-S`
      : `S-${utcTodayPrefix}-${decodedInput.serviceId}-S`;
  const uPartitionKey =
    decodedInput.subscriptionKind === "PROFILE"
      ? `P-${utcTodayPrefix}-U`
      : `S-${utcTodayPrefix}-${decodedInput.serviceId}-U`;

  const sKey = `${sPartitionKey}-${fiscalCodeHash}`;
  const uKey = `${uPartitionKey}-${fiscalCodeHash}`;

  const updateSubscriptionStatusHandler = updateSubscriptionStatus(
    tableService,
    subscriptionFeedTableName
  );
  if (operation === "SUBSCRIBED") {
    // we delete the entry from the unsubscriptions and we add it to the
    // subscriptions
    await updateSubscriptionStatusHandler(
      context,
      updateLogPrefix,
      version,
      uPartitionKey,
      uKey,
      sPartitionKey,
      sKey
    );
  } else {
    // we delete the entry from the subscriptions and we add it to the
    // unsubscriptions
    await updateSubscriptionStatusHandler(
      context,
      updateLogPrefix,
      version,
      sPartitionKey,
      sKey,
      uPartitionKey,
      uKey
    );
  }

  return "SUCCESS";
};
