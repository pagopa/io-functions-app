import { Context } from "@azure/functions";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { TransientNotImplementedFailure } from "../utils/durable";
import { MagicLinkServiceClient } from "./utils";

// magic link service response
const MagicLinkServiceResponse = t.interface({
  magic_code: NonEmptyString
});

type MagicLinkServiceResponse = t.TypeOf<typeof MagicLinkServiceResponse>;

// Activity input
export const ActivityInput = t.interface({
  family_name: NonEmptyString,
  fiscal_code: FiscalCode,
  name: NonEmptyString
});

export type ActivityInput = t.TypeOf<typeof ActivityInput>;

// Activity result
export const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS"),
  value: MagicLinkServiceResponse
});

const GeneralFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

type GeneralFailure = t.TypeOf<typeof GeneralFailure>;

const ActivityResultFailure = t.union([
  GeneralFailure,
  TransientNotImplementedFailure
]);

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);

export type ActivityResult = t.TypeOf<typeof ActivityResult>;

const logPrefix = "GetMagicCodeActivity";

export const getActivityHandler = (
  magicCodeService: MagicLinkServiceClient
) => async (context: Context, input: unknown): Promise<ActivityResult> =>
  pipe(
    input,
    ActivityInput.decode,
    E.mapLeft(errors => {
      context.log.error(
        `${logPrefix}|Error while decoding input|ERROR=${readableReportSimplified(
          errors
        )}`
      );

      return ActivityResultFailure.encode({
        kind: "FAILURE",
        reason: "Error while decoding input"
      });
    }),
    TE.fromEither,
    // TODO: implement the actual call to magic link service to get a
    // magicCode
    TE.chain(activityInput =>
      pipe(
        TE.tryCatch(
          () =>
            magicCodeService.getMagicCodeForUser(
              activityInput.fiscal_code,
              activityInput.name,
              activityInput.family_name
            ),
          E.toError
        ),
        TE.mapLeft(_ =>
          ActivityResultFailure.encode({
            kind: "NOT_YET_IMPLEMENTED",
            reason: "call not yet implemented"
          })
        )
      )
    ),
    TE.map(serviceResponse =>
      ActivityResultSuccess.encode({
        kind: "SUCCESS",
        value: serviceResponse
      })
    ),
    TE.toUnion
  )();
