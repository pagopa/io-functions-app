/* tslint:disable: no-any */

import * as lolex from "lolex";

import { ulidGenerator } from "io-functions-commons/dist/src/utils/strings";

import { context as contextMock } from "../../__mocks__/durable-functions";
import { aFiscalCode } from "../../__mocks__/mocks";
import {
  ActivityInput as CreateVerificationTokenActivityInput,
  getCreateVerificationTokenActivityHandler
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

describe("CreateVerificationTokenActivityHandler", () => {
  it("should create a verificationtoken table entity", async () => {
    const id = ulidGenerator();
    const ulidGeneratorMock = jest.fn(() => id);
    const tableServiceMock = {
      insertEntity: jest.fn((_, __, f) => {
        f(undefined, {});
      })
    };

    const handler = getCreateVerificationTokenActivityHandler(
      ulidGeneratorMock,
      tableServiceMock as any,
      "TableName",
      5000 as any,
      // validator
      () => "AAAAAAAAAAAAAAAAAAAAAAAA",
      // validatorHash
      () => "1bda9f0aed80857d43c9329457f28b1ca29f736a0c539901e1ba16a909eb07b4"
    );

    const input = CreateVerificationTokenActivityInput.encode({
      fiscalCode: aFiscalCode
    });

    await handler(contextMock as any, input);

    expect(tableServiceMock.insertEntity).toHaveBeenCalledWith(
      "TableName",
      {
        FiscalCode: aFiscalCode,
        InvalidAfter: new Date(Date.now() + 5000),
        PartitionKey: id,
        RowKey:
          "1bda9f0aed80857d43c9329457f28b1ca29f736a0c539901e1ba16a909eb07b4"
      },
      expect.any(Function)
    );
  });
});
