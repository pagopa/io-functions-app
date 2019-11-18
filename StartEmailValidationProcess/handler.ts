/**
 * Start the validation process directly without changing the email in the profile.
 * Used by the application to request an email with a new verification token in case of problems.
 *
 * A new verification token is only sent if the profile email need to be validated.
 */
import * as express from "express";

import { Context } from "@azure/functions";
import * as df from "durable-functions";

import { isLeft } from "fp-ts/lib/Either";
import { isNone } from "fp-ts/lib/Option";

import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessAccepted,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseErrorValidation,
  ResponseSuccessAccepted
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { ProfileModel } from "io-functions-commons/dist/src/models/profile";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "io-functions-commons/dist/src/utils/response";

import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";

import { OrchestratorInput as EmailValidationProcessOrchestratorInput } from "../EmailValidationProcessOrchestrator/handler";

/**
 * Type of an StartEmailValidationProcess handler.
 */
type IStartEmailValidationProcessHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseSuccessJson<{}>
  | IResponseErrorValidation
  | IResponseErrorQuery
  | IResponseErrorNotFound
  | IResponseErrorConflict
  | IResponseErrorInternal
  | IResponseSuccessAccepted
>;

export function StartEmailValidationProcessHandler(
  profileModel: ProfileModel
): IStartEmailValidationProcessHandler {
  return async (context, fiscalCode) => {
    const logPrefix = `StartEmailValidationProcessHandler|FISCAL_CODE=${fiscalCode}`;

    const errorOrMaybeExistingProfile = await profileModel.findOneProfileByFiscalCode(
      fiscalCode
    );

    if (isLeft(errorOrMaybeExistingProfile)) {
      return ResponseErrorQuery(
        "Error trying to retrieve existing service",
        errorOrMaybeExistingProfile.value
      );
    }

    const maybeExistingProfile = errorOrMaybeExistingProfile.value;
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

    // Start a orchestrator that handles the email validation process.
    context.log.verbose(`${logPrefix}|Starting the email validation process`);
    const emailValidationProcessOrchestartorInput = EmailValidationProcessOrchestratorInput.encode(
      {
        email,
        fiscalCode
      }
    );

    const dfClient = df.getClient(context);
    await dfClient.startNew(
      "EmailValidationProcessOrchestrator",
      undefined,
      emailValidationProcessOrchestartorInput
    );

    return ResponseSuccessAccepted();
  };
}

/**
 * Wraps an StartEmailValidationProcess handler inside an Express request handler.
 */
export function StartEmailValidationProcess(
  profileModel: ProfileModel
): express.RequestHandler {
  const handler = StartEmailValidationProcessHandler(profileModel);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
