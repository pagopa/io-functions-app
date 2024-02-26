/**
 * Start the validation process directly without changing the email in the profile.
 * Used by the application to request an email with a new verification token in case of problems.
 *
 * A new verification token is only sent if the profile email need to be validated.
 */
import * as express from "express";

import { Context } from "@azure/functions";
import * as df from "durable-functions";

import { isLeft, toError } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

import {
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessAccepted,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorValidation,
  ResponseSuccessAccepted
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { ProfileModel } from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";

import { pipe } from "fp-ts/lib/function";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import { OrchestratorInput as EmailValidationWithTemplateProcessOrchestratorInput } from "../EmailValidationWithTemplateProcessOrchestrator/handler";
import { EmailValidationProcessParams } from "../generated/definitions/internal/EmailValidationProcessParams";
import {
  isOrchestratorRunning,
  makeStartEmailValidationProcessOrchestratorId
} from "./orchestrators";

type ReturnTypes =
  // eslint-disable-next-line @typescript-eslint/ban-types
  | IResponseSuccessJson<{}>
  | IResponseErrorValidation
  | IResponseErrorQuery
  | IResponseErrorNotFound
  | IResponseSuccessAccepted
  | IResponseErrorInternal;

/**
 * Type of an StartEmailValidationProcess handler.
 */
type IStartEmailValidationProcessHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  payload: EmailValidationProcessParams
) => Promise<ReturnTypes>;

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function StartEmailValidationProcessHandler(
  profileModel: ProfileModel
): IStartEmailValidationProcessHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async (context, fiscalCode, payload) => {
    const logPrefix = `StartEmailValidationProcessHandler|FISCAL_CODE=${fiscalCode}`;

    const errorOrMaybeExistingProfile = await profileModel.findLastVersionByModelId(
      [fiscalCode]
    )();

    if (isLeft(errorOrMaybeExistingProfile)) {
      return ResponseErrorQuery(
        "Error trying to retrieve existing service",
        errorOrMaybeExistingProfile.left
      );
    }

    const maybeExistingProfile = errorOrMaybeExistingProfile.right;
    if (isNone(maybeExistingProfile)) {
      return ResponseErrorNotFound(
        "Error",
        "Could not find a profile with the provided fiscalcode"
      );
    }

    const existingProfile = maybeExistingProfile.value;

    if (existingProfile.isEmailValidated === true) {
      return ResponseErrorValidation(
        "Validation error",
        "The email is already validated"
      );
    }

    const { email } = existingProfile;

    // The API is available, but the client should never permit to call it
    // when the email is undefined. The corner case is handled returning
    // an Internal Server Error.
    if (email === undefined) {
      return ResponseErrorInternal(
        "Unexpected missing email inside the user Profile"
      );
    }

    // Start a orchestrator that handles the email validation process.
    context.log.verbose(
      `${logPrefix}|Starting the email validation with template process`
    );
    const emailValidationWithTemplateProcessOrchestartorInput = EmailValidationWithTemplateProcessOrchestratorInput.encode(
      {
        email,
        fiscalCode,
        name: payload.name
      }
    );

    const dfClient = df.getClient(context);
    return pipe(
      TE.of(makeStartEmailValidationProcessOrchestratorId(fiscalCode, email)),
      TE.chain(orchId =>
        pipe(
          isOrchestratorRunning(dfClient, orchId),
          TE.chain(
            TE.fromPredicate(
              _ => _.isRunning,
              () => new Error("Not Running")
            )
          ),
          TE.fold(
            () =>
              TE.tryCatch(
                () =>
                  dfClient.startNew(
                    "EmailValidationWithTemplateProcessOrchestrator",
                    orchId,
                    emailValidationWithTemplateProcessOrchestartorInput
                  ),
                toError
              ),
            _ => TE.of(String(_.isRunning))
          )
        )
      ),
      TE.bimap(
        e => ResponseErrorInternal(String(e)),
        () => ResponseSuccessAccepted("", undefined)
      ),
      TE.toUnion
    )();
  };
}

/**
 * Wraps an StartEmailValidationProcess handler inside an Express request handler.
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function StartEmailValidationProcess(
  profileModel: ProfileModel
): express.RequestHandler {
  const handler = StartEmailValidationProcessHandler(profileModel);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredBodyPayloadMiddleware(EmailValidationProcessParams)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
