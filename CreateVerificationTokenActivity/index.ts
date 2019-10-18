import * as crypto from "crypto";

import { createTableService } from "azure-storage";

import { Millisecond } from "italia-ts-commons/lib/units";

import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { ulidGenerator } from "io-functions-commons/dist/src/utils/strings";

import { getCreateVerificationTokenActivityHandler } from "./handler";

const TOKEN_INVALID_AFTER_MS = (1000 * 60 * 60 * 24 * 30) as Millisecond; // 1 Month

const storageConnectionString = getRequiredStringEnv("StorageConnection");
const verificationTokensTableName = getRequiredStringEnv(
  "VERIFICATION_TOKENS_TABLE_NAME"
);

const tableService = createTableService(storageConnectionString);

const randomBytesGenerator = (size: number) =>
  crypto.randomBytes(size).toString("hex");

const hashCreator = (value: string) =>
  crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");

const activityFunctionHandler = getCreateVerificationTokenActivityHandler(
  ulidGenerator,
  tableService,
  verificationTokensTableName,
  TOKEN_INVALID_AFTER_MS,
  randomBytesGenerator,
  hashCreator
);

export default activityFunctionHandler;
