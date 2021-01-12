/**
 * This activity creates a ValidationToken entity in a table storage.
 *
 * The validation process use a `id and validator` strategy.
 *
 * The `id` is generated using an ulid generator and is used when searching
 * a specific ValidationToken entity in the table storage.
 *
 * For the `validator` we use a random-bytes generator. This `validator` value is
 * hashed using the `sha256` strategy and then stored in the entity as `validatorHash`
 *
 * Each token has also a `InvalidAfter` field to set the token lifetime.
 */

import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";

import { Context } from "@azure/functions";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { EmailString, FiscalCode } from "italia-ts-commons/lib/strings";

import { TableService } from "azure-storage";
import { ValidationTokenEntity } from "@pagopa/io-functions-commons/dist/src/entities/validation_token";
import { insertTableEntity } from "@pagopa/io-functions-commons/dist/src/utils/azure_storage";
import { ObjectIdGenerator } from "@pagopa/io-functions-commons/dist/src/utils/strings";
import { Millisecond } from "italia-ts-commons/lib/units";

// Activity input
export const ActivityInput = t.interface({
  email: EmailString,
  fiscalCode: FiscalCode
});

export type ActivityInput = t.TypeOf<typeof ActivityInput>;

// Activity result
const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS"),
  value: t.interface({
    validationTokenEntity: ValidationTokenEntity,
    validator: t.string
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

export const getCreateValidationTokenActivityHandler = (
  ulidGenerator: ObjectIdGenerator,
  tableService: TableService,
  validationTokensTableName: string,
  tokenInvalidAfterMS: Millisecond,
  randomBytesGenerator: (size: number) => string,
  hashCreator: (value: string) => string
) => async (context: Context, input: unknown): Promise<unknown> => {
  const logPrefix = `CreateValidationTokenActivity`;

  const errorOrCreateValidationTokenActivityInput = ActivityInput.decode(input);

  if (isLeft(errorOrCreateValidationTokenActivityInput)) {
    context.log.error(
      `${logPrefix}|Error decoding input|ERROR=${readableReport(
        errorOrCreateValidationTokenActivityInput.value
      )}`
    );
    return ActivityResultFailure.encode({
      kind: "FAILURE",
      reason: "Error decoding input"
    });
  }

  const createValidationTokenActivityInput =
    errorOrCreateValidationTokenActivityInput.value;

  // Log the input
  context.log.verbose(
    `${logPrefix}|INPUT=${JSON.stringify(createValidationTokenActivityInput)}`
  );

  const { fiscalCode, email } = createValidationTokenActivityInput;

  // Generate id, tokenId and validator
  const id = ulidGenerator();
  const tokenId = id;
  const validator = randomBytesGenerator(12);
  const validatorHash = hashCreator(validator);

  const validationTokenEntity: ValidationTokenEntity = {
    Email: email,
    FiscalCode: fiscalCode,
    InvalidAfter: new Date(Date.now() + (tokenInvalidAfterMS as number)),
    PartitionKey: tokenId,
    RowKey: validatorHash
  };

  const errorOrCreatedValidationTokenEntity = await insertTableEntity(
    tableService,
    validationTokensTableName,
    validationTokenEntity
  );

  if (isLeft(errorOrCreatedValidationTokenEntity)) {
    const error = Error(
      `${logPrefix}|Error creating new validation token|ERROR=${errorOrCreatedValidationTokenEntity.value}`
    );
    context.log.error(error.message);
    throw error;
  }

  const createdValidationTokenEntity =
    errorOrCreatedValidationTokenEntity.value;

  context.log.verbose(
    `${logPrefix}|Validation token created|ENTITY=${JSON.stringify(
      createdValidationTokenEntity
    )}`
  );

  return ActivityResult.encode({
    kind: "SUCCESS",
    value: {
      validationTokenEntity,
      validator
    }
  });
};
