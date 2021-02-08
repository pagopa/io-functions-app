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

import { ExtendedProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/ExtendedProfile";
import { NewProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/NewProfile";
import {
  NewProfile as INewProfile,
  Profile,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  CosmosDecodingError,
  CosmosErrors
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import { fromEither } from "fp-ts/lib/TaskEither";
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
      isEmailEnabled: true,
      isEmailValidated: createProfilePayload.is_email_validated,
      isInboxEnabled: false,
      isTestProfile: createProfilePayload.is_test_profile,
      isWebhookEnabled: false
    };

    const errorOrCreatedProfile = await fromEither(
      INewProfile.decode({
        ...profile,
        kind: "INewProfile"
      })
    )
      .mapLeft<CosmosErrors>(CosmosDecodingError)
      .chain(newProfile => profileModel.create(newProfile))
      .run();

    if (isLeft(errorOrCreatedProfile)) {
      const failure = errorOrCreatedProfile.value;

      context.log.error(`${logPrefix}|ERROR=${failure.kind}`);

      // Conflict, resource already exists
      if (
        failure.kind === "COSMOS_ERROR_RESPONSE" &&
        failure.error.code === 409
      ) {
        return ResponseErrorConflict(
          "A profile with the requested fiscal_code already exists"
        );
      }

      return ResponseErrorQuery("Error while creating a new profile", failure);
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
