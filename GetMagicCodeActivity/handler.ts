import { Context } from "@azure/functions";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { flow, pipe } from "fp-ts/function";
import {
  errorsToReadableMessages,
  readableReportSimplified
} from "@pagopa/ts-commons/lib/reporters";
import { TransientNotImplementedFailure } from "../utils/durable";
import { MagicLinkServiceClient } from "./utils";

// magic link service response
const MagicLinkServiceResponse = t.interface({
  magic_link: NonEmptyString
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
  magicLinkService: MagicLinkServiceClient
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
    TE.chain(({ name, family_name, fiscal_code }) =>
      pipe(
        TE.tryCatch(
          () =>
            magicLinkService.getMagicLinkToken({
              body: { family_name, fiscal_number: fiscal_code, name }
            }),
          () =>
            ActivityResultFailure.encode({
              kind: "FAILURE",
              reason: "Error while calling magic link service"
            })
        ),
        TE.chainEitherKW(
          flow(
            E.mapLeft(errors =>
              ActivityResultFailure.encode({
                kind: "FAILURE",
                reason: `magic link service returned an unexpected response: ${errorsToReadableMessages(
                  errors
                )}`
              })
            )
          )
        ),
        TE.chain(({ status, value }) =>
          status === 200
            ? TE.right(value)
            : TE.left(
                ActivityResultFailure.encode({
                  kind: "FAILURE",
                  reason: `magic link service returned ${status}`
                })
              )
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
