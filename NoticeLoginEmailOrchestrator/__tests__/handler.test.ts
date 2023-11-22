import {
  EmailString,
  IPString,
  NonEmptyString
} from "@pagopa/ts-commons/lib/strings";
import * as df from "durable-functions";
import { consumeGenerator } from "../../utils/durable";
import {
  getNoticeLoginEmailOrchestratorHandler,
  OrchestratorFailureResult,
  OrchestratorInput,
  OrchestratorSuccessResult
} from "../handler";
import { aFiscalCode } from "../../__mocks__/mocks";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { Task } from "durable-functions/lib/src/classes";

const someRetryOptions = new df.RetryOptions(5000, 10);
// eslint-disable-next-line functional/immutable-data
someRetryOptions.backoffCoefficient = 1.5;

const aDate = new Date("1970-01-01");
const anIPAddress = "127.0.0.1" as IPString;
const aValidOrchestratorInput: OrchestratorInput = {
  date_time: aDate,
  email: "example@example.com" as EmailString,
  family_name: "foo" as NonEmptyString,
  fiscal_code: aFiscalCode,
  identity_provider: "idp" as NonEmptyString,
  ip_address: anIPAddress,
  name: "foo" as NonEmptyString,
  device_name: "aDevice" as NonEmptyString,
  is_email_validated: true
};
const mockCallActivityFunction = jest.fn();
const mockGetInput = jest.fn().mockReturnValue(aValidOrchestratorInput);
const contextMockWithDf = {
  ...contextMock,
  df: {
    Task: {
      all: (tasks: readonly Task[]) => tasks
    },
    callActivityWithRetry: mockCallActivityFunction,
    getInput: mockGetInput
  }
};

describe("NoticeLoginEmailOrchestratorHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return an orchestrator success when a valid payload is given", () => {
    mockCallActivityFunction.mockReturnValueOnce({
      kind: "SUCCESS",
      value: { geo_location: "Rome" as NonEmptyString }
    });

    mockCallActivityFunction.mockReturnValueOnce({
      kind: "SUCCESS",
      value: { magic_link: "dummy" as NonEmptyString }
    });

    mockCallActivityFunction.mockReturnValueOnce({
      kind: "SUCCESS"
    });
    const orchestratorHandler = getNoticeLoginEmailOrchestratorHandler(
      contextMockWithDf as any
    );

    const result = consumeGenerator(orchestratorHandler);

    expect(mockGetInput).toHaveBeenCalledTimes(1);
    expect(mockCallActivityFunction).toHaveBeenCalledTimes(3);
    expect(mockCallActivityFunction).toHaveBeenNthCalledWith(
      1,
      "GetGeoLocationDataActivity",
      someRetryOptions,
      {
        ip_address: anIPAddress
      }
    );
    expect(mockCallActivityFunction).toHaveBeenNthCalledWith(
      2,
      "GetMagicCodeActivity",
      someRetryOptions,
      {
        family_name: "foo",
        name: "foo",
        fiscal_code: aFiscalCode
      }
    );
    expect(mockCallActivityFunction).toHaveBeenNthCalledWith(
      3,
      "SendTemplatedLoginEmailActivity",
      someRetryOptions,
      {
        date_time: aDate.getTime(),
        name: "foo",
        ip_address: anIPAddress,
        magic_link: "dummy",
        identity_provider: "idp",
        geo_location: "Rome",
        email: "example@example.com",
        device_name: "aDevice"
      }
    );
    expect(OrchestratorSuccessResult.is(result)).toEqual(true);
  });

  it("should return a decode error when input is not valid", () => {
    mockGetInput.mockReturnValueOnce({});
    const orchestratorHandler = getNoticeLoginEmailOrchestratorHandler(
      contextMockWithDf as any
    );

    const result = consumeGenerator(orchestratorHandler);

    expect(mockCallActivityFunction).toHaveBeenCalledTimes(0);
    if (OrchestratorFailureResult.is(result)) {
      expect(result).toMatchObject({
        kind: "FAILURE",
        reason: expect.stringContaining("Error decoding input")
      });
    } else {
      fail();
    }
  });

  it.each`
    scenario                                                         | value
    ${"the user doesn't have a validated email"}                     | ${false}
    ${"the api was called without the is_email_validated parameter"} | ${undefined}
  `("should ignore magic_link retrieval if $scenario", ({ value }) => {
    mockGetInput.mockReturnValueOnce({
      ...aValidOrchestratorInput,
      is_email_validated: value
    });

    mockCallActivityFunction.mockReturnValueOnce({
      kind: "SUCCESS",
      value: { geo_location: "Rome" as NonEmptyString }
    });

    mockCallActivityFunction.mockReturnValueOnce({
      kind: "SUCCESS"
    });
    const orchestratorHandler = getNoticeLoginEmailOrchestratorHandler(
      contextMockWithDf as any
    );

    const result = consumeGenerator(orchestratorHandler);

    // we only call 2 activities because the user doesn't have a validated email
    expect(mockCallActivityFunction).toHaveBeenCalledTimes(2);

    expect(mockCallActivityFunction).toHaveBeenNthCalledWith(
      1,
      "GetGeoLocationDataActivity",
      someRetryOptions,
      {
        ip_address: anIPAddress
      }
    );
    expect(mockCallActivityFunction).toHaveBeenNthCalledWith(
      2,
      "SendTemplatedLoginEmailActivity",
      someRetryOptions,
      {
        date_time: aDate.getTime(),
        name: "foo",
        ip_address: anIPAddress,
        //since we ignored the magic_link retrieval, this MUST be unfedined
        magic_link: undefined,
        identity_provider: "idp",
        geo_location: "Rome",
        email: "example@example.com",
        device_name: "aDevice"
      }
    );
    expect(OrchestratorSuccessResult.is(result)).toEqual(true);
  });
});
