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
import { withDefault } from "@pagopa/ts-commons/lib/types";
import {
  ActivityInput as SendTemplatedLoginEmailActivityInput,
  ActivityResultSuccess as SendTemplatedLoginEmailActivityResultSuccess
} from "../SendTemplatedLoginEmailActivity/handler";
import {
  ActivityInput as GetMagicCodeActivityInput,
  ActivityResult as GetMagicCodeActivityResult
} from "../GetMagicCodeActivity/handler";
import {
  ActivityInput as GetGeoLocationActivityInput,
  ActivityResult as GetGeoLocationActivityResult
} from "../GetGeoLocationDataActivity/handler";
import { toHash } from "../utils/crypto";

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
    device_name: NonEmptyString,
    is_email_validated: withDefault(t.boolean, false)
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
  /* eslint-disable @typescript-eslint/naming-convention */
  const {
    fiscal_code,
    name,
    family_name,
    email,
    date_time,
    device_name,
    ip_address,
    identity_provider,
    is_email_validated
  } = orchestratorInput;
  /* eslint-enable @typescript-eslint/naming-convention */

  // Log the input
  context.log.verbose(
    `${logPrefix}|INPUT=${JSON.stringify({
      ...orchestratorInput,
      email: toHash(orchestratorInput.email),
      family_name: toHash(orchestratorInput.family_name),
      fiscal_code: toHash(orchestratorInput.fiscal_code),
      name: toHash(orchestratorInput.name)
    })}`
  );

  try {
    context.log.verbose(`${logPrefix}|Starting GetGeoLocationDataActivity`);
    const geoLocationActivityInput = GetGeoLocationActivityInput.encode({
      ip_address
    });

    // eslint-disable-next-line functional/no-let, @typescript-eslint/naming-convention
    let geo_location: NonEmptyString | undefined;
    try {
      const geoLocationActivityResult = yield context.df.callActivityWithRetry(
        "GetGeoLocationDataActivity",
        retryOptions,
        geoLocationActivityInput
      );
      const errorOrGeoLocationServiceResponse = GetGeoLocationActivityResult.decode(
        geoLocationActivityResult
      );

      if (E.isRight(errorOrGeoLocationServiceResponse)) {
        if (errorOrGeoLocationServiceResponse.right.kind === "SUCCESS") {
          geo_location =
            errorOrGeoLocationServiceResponse.right.value.geo_location;
        } else {
          context.log.error(
            `${logPrefix}|GetGeoLocationDataActivity failed with ${errorOrGeoLocationServiceResponse.right.reason}`
          );
        }
      }
    } catch (_) {
      // log activity max retry reached
      // we let geo_location be undefined
      context.log.error(
        `${logPrefix}|GetGeoLocationDataActivity max retry reached`
      );
    }

    // the base template will be sent if:
    // 1. the user doesn't have a validated email
    // 2. the user does have a validated email but the magic_link couldn't be retrieved
    //
    // eslint-disable-next-line functional/no-let, @typescript-eslint/naming-convention
    let magic_link: NonEmptyString | undefined;
    if (is_email_validated) {
      context.log.verbose(`${logPrefix}|Starting GetMagicCodeActivity`);
      const magicCodeActivityInput = GetMagicCodeActivityInput.encode({
        family_name,
        fiscal_code,
        name
      });

      try {
        const magicCodeActivityResult = yield context.df.callActivityWithRetry(
          "GetMagicCodeActivity",
          retryOptions,
          magicCodeActivityInput
        );

        const errorOrMagicLinkServiceResponse = GetMagicCodeActivityResult.decode(
          magicCodeActivityResult
        );
        if (E.isRight(errorOrMagicLinkServiceResponse)) {
          if (errorOrMagicLinkServiceResponse.right.kind === "SUCCESS") {
            magic_link = errorOrMagicLinkServiceResponse.right.value.magic_link;
          } else {
            context.log.error(
              `${logPrefix}|GetMagicCodeActivity failed with ${errorOrMagicLinkServiceResponse.right.reason}`
            );
          }
        }
      } catch (_) {
        // log activity max retry reached
        // we let magic_code be undefined and continue to send the base login email template
        context.log.error(
          `${logPrefix}|GetMagicCodeActivity max retry reached`
        );
      }
    } else {
      context.log.verbose(
        `${logPrefix}|Ignoring GetMagicCodeActivity. The user doesn't have a validated email`
      );
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
        magic_link,
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
