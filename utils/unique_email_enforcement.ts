import { TableClient } from "@azure/data-tables";

import { getConfigOrThrow } from "../utils/config";
import { getIsUserEligibleForNewFeature } from "./featureFlag";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

const config = getConfigOrThrow();

export const profileEmailTableClient = TableClient.fromConnectionString(
  config.PROFILE_EMAIL_STORAGE_CONNECTION_STRING,
  config.PROFILE_EMAIL_STORAGE_TABLE_NAME
);

export const FF_UNIQUE_EMAIL_ENFORCEMENT_ENABLED = getIsUserEligibleForNewFeature<
  FiscalCode
>(
  fiscalCode => config.FF_UNIQUE_EMAIL_ENFORCEMENT_USERS.includes(fiscalCode),
  () => false,
  config.FF_UNIQUE_EMAIL_ENFORCEMENT
);
