import { TableClient } from "@azure/data-tables";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { getConfigOrThrow } from "../utils/config";
import { getIsUserEligibleForNewFeature } from "./featureFlag";

const config = getConfigOrThrow();

export const profileEmailTableClient = TableClient.fromConnectionString(
  config.PROFILE_EMAIL_STORAGE_CONNECTION_STRING,
  config.PROFILE_EMAIL_STORAGE_TABLE_NAME
);
