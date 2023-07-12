import {
  EmailString,
  FiscalCode,
  IPString,
  NonEmptyString
} from "@pagopa/ts-commons/lib/strings";
import { IOrchestrationFunctionContext } from "durable-functions/lib/src/iorchestrationfunctioncontext";
import * as t from "io-ts";
import * as df from "durable-functions";
import * as E from "fp-ts/lib/Either";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { DateFromTimestamp } from "@pagopa/ts-commons/lib/dates";
import {
  ActivityInput as SendTemplatedLoginEmailActivityInput,
  ActivityResultSuccess as SendTemplatedLoginEmailActivityResultSuccess
} from "../SendTemplatedLoginEmailActivity/handler";
import {
  ActivityInput as GetMagicCodeActivityInput,
  ActivityResultSuccess as GetMagicCodeActivityResultSuccess
} from "../GetMagicCodeActivity/handler";
import {
  ActivityInput as GetGeoLocationActivityInput,
  ActivityResultSuccess as GetGeoLocationActivityResultSuccess
} from "../GetGeoLocationDataActivity/handler";
import { TransientApiCallFailure } from "../utils/durable";

// Input
export const OrchestratorInput = t.intersection([
  t.interface({
    date_time: DateFromTimestamp,
    email: EmailString,
    family_name: NonEmptyString,
    fiscal_code: FiscalCode,
    identity_provider: NonEmptyString,
    ip_address: IPString,
    name: NonEmptyString
  }),
  t.partial({
    device_name: NonEmptyString
  })
]);

export type OrchestratorInput = t.TypeOf<typeof OrchestratorInput>;

// Result
export const OrchestratorSuccessResult = t.interface({
  kind: t.literal("SUCCESS")
});

export const OrchestratorFailureResult = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

export const OrchestratorResult = t.taggedUnion("kind", [
  OrchestratorSuccessResult,
  OrchestratorFailureResult
]);

export type OrchestratorResult = t.TypeOf<typeof OrchestratorResult>;

export const getNoticeLoginEmailOrchestratorHandler = function*(
  context: IOrchestrationFunctionContext
): Generator<unknown> {
  const logPrefix = "NoticeLoginEmailOrchestrator";

  const retryOptions = new df.RetryOptions(5000, 10);
  // eslint-disable-next-line functional/immutable-data
  retryOptions.backoffCoefficient = 1.5;

  context.log.verbose(`${logPrefix}|Notice login email process started`);

  // Decode input
  const input = context.df.getInput();
  const errorOrOrchestratorInput = OrchestratorInput.decode(input);
  if (E.isLeft(errorOrOrchestratorInput)) {
    const error = Error(
      `${logPrefix}|Error decoding input|ERROR=${readableReportSimplified(
        errorOrOrchestratorInput.left
      )}`
    );
    context.log.error(error.message);
    return OrchestratorFailureResult.encode({
      kind: "FAILURE",
      reason: error.message
    });
    // We don't throw an error because we can't do a retry in this scenario
  }

  const orchestratorInput = errorOrOrchestratorInput.right;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    fiscal_code,
    name,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    family_name,
    email,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    date_time,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    device_name,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ip_address,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    identity_provider
  } = orchestratorInput;

  // Log the input
  context.log.verbose(
    `${logPrefix}|INPUT=${JSON.stringify(orchestratorInput)}`
  );

  try {
    context.log.verbose(`${logPrefix}|Starting GetGeoLocationDataActivity`);
    const geoLocationActivityInput = GetGeoLocationActivityInput.encode({
      ip_address
    });

    const geoLocationActivityResult = yield context.df.callActivityWithRetry(
      "GetGeoLocationDataActivity",
      retryOptions,
      geoLocationActivityInput
    );
    const errorOrGeoLocationServiceResponse = GetGeoLocationActivityResultSuccess.decode(
      geoLocationActivityResult
    );

    // eslint-disable-next-line functional/no-let, @typescript-eslint/naming-convention
    let geo_location: NonEmptyString | undefined;
    if (E.isLeft(errorOrGeoLocationServiceResponse)) {
      // we let geo_location be undefined.
      // the SendTemplatedLoginEmailActivity will decide what email template to use based on the geo_location value
      if (!TransientApiCallFailure.is(geoLocationActivityResult)) {
        throw OrchestratorFailureResult.encode({
          kind: "FAILURE",
          reason: readableReportSimplified(
            errorOrGeoLocationServiceResponse.left
          )
        });
      }
    } else {
      geo_location = errorOrGeoLocationServiceResponse.right.value.geo_location;
    }

    context.log.verbose(`${logPrefix}|Starting GetMagicCodeActivity`);
    const magicCodeActivityInput = GetMagicCodeActivityInput.encode({
      family_name,
      fiscal_code,
      name
    });
    const magicCodeActivityResult = yield context.df.callActivityWithRetry(
      "GetMagicCodeActivity",
      retryOptions,
      magicCodeActivityInput
    );

    const errorOrMagicLinkServiceResponse = GetMagicCodeActivityResultSuccess.decode(
      magicCodeActivityResult
    );

    // eslint-disable-next-line functional/no-let, @typescript-eslint/naming-convention
    let magic_code: NonEmptyString | undefined;
    if (E.isLeft(errorOrMagicLinkServiceResponse)) {
      // we let magic_code be undefined and pass it to the next activity.
      // the SendTemplatedLoginEmailActivity will decide what email template to use based on the magic_code value
      if (!TransientApiCallFailure.is(magicCodeActivityResult)) {
        throw OrchestratorFailureResult.encode({
          kind: "FAILURE",
          reason: readableReportSimplified(errorOrMagicLinkServiceResponse.left)
        });
      }
    } else {
      magic_code = errorOrMagicLinkServiceResponse.right.value.magic_code;
    }

    context.log.verbose(`${logPrefix}|Starting SendLoginEmailActivity`);
    const loginEmailActivityInput = SendTemplatedLoginEmailActivityInput.encode(
      {
        date_time,
        device_name,
        email,
        geo_location,
        identity_provider,
        ip_address,
        magic_code,
        name
      }
    );
    const sendMailActivityResult = yield context.df.callActivityWithRetry(
      "SendTemplatedLoginEmailActivity",
      retryOptions,
      loginEmailActivityInput
    );

    const errorOrSendMailActivityResult = SendTemplatedLoginEmailActivityResultSuccess.decode(
      sendMailActivityResult
    );

    if (E.isLeft(errorOrSendMailActivityResult)) {
      throw OrchestratorFailureResult.encode({
        kind: "FAILURE",
        reason: readableReportSimplified(errorOrSendMailActivityResult.left)
      });
    }

    // success scenario
    return OrchestratorSuccessResult.encode({ kind: "SUCCESS" });
  } catch (e) {
    const error = Error(`${logPrefix}|Max retry exceeded|ERROR=${e}`);
    context.log.error(error.message);
    // Throw an error so the whole process is retried
    throw error;
  }
};
