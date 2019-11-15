import * as crypto from "crypto";

import { createTableService } from "azure-storage";

import { Millisecond } from "italia-ts-commons/lib/units";

import { VALIDATION_TOKEN_TABLE_NAME } from "io-functions-commons/dist/src/entities/validation_token";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { ulidGenerator } from "io-functions-commons/dist/src/utils/strings";

import { getCreateValidationTokenActivityHandler } from "./handler";

const TOKEN_INVALID_AFTER_MS = (1000 * 60 * 60 * 24 * 30) as Millisecond; // 30 days

// TODO: Rename this env to `StorageConnection`
// https://www.pivotaltracker.com/story/show/169591817
const storageConnectionString = getRequiredStringEnv("QueueStorageConnection");

const tableService = createTableService(storageConnectionString);

const randomBytesGenerator = (size: number) =>
  crypto.randomBytes(size).toString("hex");

const hashCreator = (value: string) =>
  crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");

const activityFunctionHandler = getCreateValidationTokenActivityHandler(
  ulidGenerator,
  tableService,
  VALIDATION_TOKEN_TABLE_NAME,
  TOKEN_INVALID_AFTER_MS,
  randomBytesGenerator,
  hashCreator
);

export default activityFunctionHandler;
