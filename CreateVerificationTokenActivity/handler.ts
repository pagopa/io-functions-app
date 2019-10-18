import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import { Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { TableService } from "azure-storage";
import { VerificationTokenEntity } from "io-functions-commons/dist/src/entities/verification_token";
import { insertTableEntity } from "io-functions-commons/dist/src/utils/azure_storage";
import { ObjectIdGenerator } from "io-functions-commons/dist/src/utils/strings";
import { Millisecond } from "italia-ts-commons/lib/units";

// Activity input
export const ActivityInput = t.interface({
  fiscalCode: FiscalCode
});
export type ActivityInput = t.TypeOf<typeof ActivityInput>;

// Activity result
const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS"),
  value: t.interface({
    validator: t.string,
    verificationTokenEntity: VerificationTokenEntity
  })
});

const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);

export type ActivityResult = t.TypeOf<typeof ActivityResult>;

export const getCreateVerificationTokenActivityHandler = (
  ulidGenerator: ObjectIdGenerator,
  tableService: TableService,
  verificationTokensTableName: string,
  tokenInvalidAfterMS: Millisecond,
  randomBytesGenerator: (size: number) => string,
  hashCreator: (value: string) => string
) => async (context: Context, input: unknown): Promise<unknown> => {
  const logPrefix = "CreateVerificationTokenActivity";

  const errorOrCreateVerificationTokenActivityInput = ActivityInput.decode(
    input
  );

  if (isLeft(errorOrCreateVerificationTokenActivityInput)) {
    context.log.error(
      `${logPrefix}|Error decoding input|ERROR=${readableReport(
        errorOrCreateVerificationTokenActivityInput.value
      )}`
    );
    return ActivityResultFailure.encode({
      kind: "FAILURE",
      reason: "Error decoding input"
    });
  }

  const createVerificationTokenActivityInput =
    errorOrCreateVerificationTokenActivityInput.value;

  const { fiscalCode } = createVerificationTokenActivityInput;

  // Generate id, tokenId and validator
  const id = ulidGenerator();
  const tokenId = id;
  const validator = randomBytesGenerator(12);
  const validatorHash = hashCreator(validator);

  const verificationTokenEntity: VerificationTokenEntity = {
    FiscalCode: fiscalCode,
    InvalidAfter: new Date(Date.now() + (tokenInvalidAfterMS as number)),
    PartitionKey: tokenId,
    RowKey: validatorHash
  };

  const errorOrCreatedVerificationTokenEntity = await insertTableEntity(
    tableService,
    verificationTokensTableName,
    verificationTokenEntity
  );

  if (isLeft(errorOrCreatedVerificationTokenEntity)) {
    const error = Error(
      `${logPrefix}|Error creating new verification token|ERROR=${errorOrCreatedVerificationTokenEntity.value}`
    );
    context.log.error(error.message);
    throw error;
  }

  const createdVerificationTokenEntity =
    errorOrCreatedVerificationTokenEntity.value;

  context.log.verbose(
    `${logPrefix}|Verification token created|ENTITY=${JSON.stringify(
      createdVerificationTokenEntity
    )}`
  );

  return ActivityResult.encode({
    kind: "SUCCESS",
    value: {
      validator,
      verificationTokenEntity
    }
  });
};
