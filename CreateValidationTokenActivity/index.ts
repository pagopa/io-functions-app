import { createTableService } from "azure-storage";

import { Millisecond } from "@pagopa/ts-commons/lib/units";

import { VALIDATION_TOKEN_TABLE_NAME } from "@pagopa/io-functions-commons/dist/src/entities/validation_token";
import { ulidGenerator } from "@pagopa/io-functions-commons/dist/src/utils/strings";

import { getConfigOrThrow } from "../utils/config";
import { randomBytes, toHash } from "../utils/crypto";
import { getCreateValidationTokenActivityHandler } from "./handler";

const config = getConfigOrThrow();

const TOKEN_INVALID_AFTER_MS = (1000 * 60 * 60 * 24 * 30) as Millisecond; // 30 days

// TODO: Rename this env to `StorageConnection`
// https://www.pivotaltracker.com/story/show/169591817

const tableService = createTableService(config.QueueStorageConnection);

// When the function starts, attempt to create the table if it does not exist
// Note that we cannot log anything just yet since we don't have a Context
tableService.createTableIfNotExists(VALIDATION_TOKEN_TABLE_NAME, () => 0);

const activityFunctionHandler = getCreateValidationTokenActivityHandler(
  ulidGenerator,
  tableService,
  VALIDATION_TOKEN_TABLE_NAME,
  TOKEN_INVALID_AFTER_MS,
  randomBytes,
  toHash
);

export default activityFunctionHandler;
