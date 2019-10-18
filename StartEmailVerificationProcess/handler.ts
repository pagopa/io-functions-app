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

import { OrchestratorInput as EmailVerificationProcessOrchestratorInput } from "../EmailVerificationProcessOrchestrator/handler";

/**
 * Type of an StartEmailVerificationProcess handler.
 */
type IStartEmailVerificationProcessHandler = (
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

export function StartEmailVerificationProcessHandler(
  profileModel: ProfileModel
): IStartEmailVerificationProcessHandler {
  return async (context, fiscalCode) => {
    const logPrefix = `StartEmailVerificationProcessHandler|FISCAL_CODE=${fiscalCode}`;

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

    // Start a orchestrator that handles the email verification process.
    context.log.verbose(`${logPrefix}|Starting the email verification process`);
    const emailVerificationProcessOrchestartorInput = EmailVerificationProcessOrchestratorInput.encode(
      {
        email,
        fiscalCode
      }
    );

    const dfClient = df.getClient(context);
    await dfClient.startNew(
      "EmailVerificationProcessOrchestrator",
      undefined,
      emailVerificationProcessOrchestartorInput
    );

    return ResponseSuccessAccepted();
  };
}

/**
 * Wraps an StartEmailVerificationProcess handler inside an Express request handler.
 */
export function StartEmailVerificationProcess(
  profileModel: ProfileModel
): express.RequestHandler {
  const handler = StartEmailVerificationProcessHandler(profileModel);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
