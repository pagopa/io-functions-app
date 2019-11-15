/* tslint:disable: no-any */

import * as lolex from "lolex";

import { VALIDATION_TOKEN_TABLE_NAME } from "io-functions-commons/dist/src/entities/validation_token";
import { ulidGenerator } from "io-functions-commons/dist/src/utils/strings";

import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aEmail,
  aFiscalCode,
  aValidator,
  aValidatorHash
} from "../../__mocks__/mocks";
import {
  ActivityInput as CreateValidationTokenActivityInput,
  getCreateValidationTokenActivityHandler
} from "../handler";

// tslint:disable-next-line: no-let
let clock: any;
beforeEach(() => {
  // We need to mock time to test token expiration.
  clock = lolex.install({ now: Date.now() });
});
afterEach(() => {
  clock = clock.uninstall();
});

describe("CreateValidationTokenActivityHandler", () => {
  it("should create a ValidationToken entity", async () => {
    const id = ulidGenerator();
    const ulidGeneratorMock = jest.fn(() => id);
    const tableServiceMock = {
      insertEntity: jest.fn((_, __, f) => {
        f(undefined, {});
      })
    };

    const handler = getCreateValidationTokenActivityHandler(
      ulidGeneratorMock,
      tableServiceMock as any,
      VALIDATION_TOKEN_TABLE_NAME,
      5000 as any,
      // validator
      () => aValidator,
      // validatorHash
      () => aValidatorHash
    );

    const input = CreateValidationTokenActivityInput.encode({
      email: aEmail,
      fiscalCode: aFiscalCode
    });

    await handler(contextMock as any, input);

    expect(tableServiceMock.insertEntity).toHaveBeenCalledWith(
      VALIDATION_TOKEN_TABLE_NAME,
      {
        Email: aEmail,
        FiscalCode: aFiscalCode,
        InvalidAfter: new Date(Date.now() + 5000),
        PartitionKey: id,
        RowKey: aValidatorHash
      },
      expect.any(Function)
    );
  });
});
