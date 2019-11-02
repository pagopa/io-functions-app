import * as express from "express";

import { Context } from "@azure/functions";
import * as df from "durable-functions";

import { isLeft } from "fp-ts/lib/Either";

import {
  IResponseErrorConflict,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { ExtendedProfile } from "io-functions-commons/dist/generated/definitions/ExtendedProfile";
import { NewProfile } from "io-functions-commons/dist/generated/definitions/NewProfile";
import {
  Profile,
  ProfileModel
} from "io-functions-commons/dist/src/models/profile";
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

import { OrchestratorInput as UpsertedProfileOrchestratorInput } from "../UpsertedProfileOrchestrator/handler";
import { NewProfileMiddleware } from "../utils/middlewares/profile";
import { retrievedProfileToExtendedProfile } from "../utils/profiles";

/**
 * Type of an CreateProfile handler.
 */
type ICreateProfileHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  NewProfile: NewProfile
) => Promise<
  | IResponseSuccessJson<ExtendedProfile>
  | IResponseErrorQuery
  | IResponseErrorConflict
>;

export function CreateProfileHandler(
  profileModel: ProfileModel
): ICreateProfileHandler {
  return async (context, fiscalCode, createProfilePayload) => {
    const logPrefix = `CreateProfileHandler|FISCAL_CODE=${fiscalCode}`;

    const profile: Profile = {
      email: createProfilePayload.email,
      fiscalCode,
      isEmailValidated: createProfilePayload.is_email_validated
    };

    const errorOrCreatedProfile = await profileModel.create(
      profile,
      profile.fiscalCode
    );

    if (isLeft(errorOrCreatedProfile)) {
      const { code, body } = errorOrCreatedProfile.value;

      context.log.error(`${logPrefix}|ERROR=${body}`);

      // Conflict, resource already exists
      if (code === 409) {
        return ResponseErrorConflict(
          "A profile with the requested fiscal_code already exists"
        );
      }

      return ResponseErrorQuery(
        "Error while creating a new profile",
        errorOrCreatedProfile.value
      );
    }

    const createdProfile = errorOrCreatedProfile.value;

    // Start the Orchestrator
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.encode(
      {
        newProfile: createdProfile,
        updatedAt: new Date()
      }
    );

    const dfClient = df.getClient(context);
    await dfClient.startNew(
      "UpsertedProfileOrchestrator",
      undefined,
      upsertedProfileOrchestratorInput
    );

    return ResponseSuccessJson(
      retrievedProfileToExtendedProfile(createdProfile)
    );
  };
}

/**
 * Wraps an CreateProfile handler inside an Express request handler.
 */
export function CreateProfile(
  profileModel: ProfileModel
): express.RequestHandler {
  const handler = CreateProfileHandler(profileModel);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    NewProfileMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
