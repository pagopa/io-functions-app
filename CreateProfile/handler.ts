import * as express from "express";

import { Context } from "@azure/functions";
import * as df from "durable-functions";

import { isLeft } from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";

import {
  IResponseErrorConflict,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import { ExtendedProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/ExtendedProfile";
import { NewProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/NewProfile";
import {
  NewProfile as INewProfile,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { CosmosDecodingError } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
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

import { isBefore } from "date-fns";
import { pipe } from "fp-ts/lib/function";
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

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function CreateProfileHandler(
  profileModel: ProfileModel,
  optOutEmailSwitchDate: Date
): ICreateProfileHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async (context, fiscalCode, createProfilePayload) => {
    const logPrefix = `CreateProfileHandler|FISCAL_CODE=${fiscalCode}`;

    const errorOrCreatedProfile = await pipe(
      fromEither(
        INewProfile.decode({
          email: createProfilePayload.email,
          fiscalCode,
          // this check can be removed after the release date for optOutEmailSwitchDate
          isEmailEnabled: isBefore(new Date(), optOutEmailSwitchDate),
          isEmailValidated: createProfilePayload.is_email_validated,
          isInboxEnabled: false,
          isTestProfile: createProfilePayload.is_test_profile,
          isWebhookEnabled: false,
          kind: "INewProfile"
        })
      ),
      TE.mapLeft(CosmosDecodingError),
      TE.chain(newProfile => profileModel.create(newProfile))
    )();

    if (isLeft(errorOrCreatedProfile)) {
      const failure = errorOrCreatedProfile.left;

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

    const createdProfile = errorOrCreatedProfile.right;

    // Start the Orchestrator
    const upsertedProfileOrchestratorInput = UpsertedProfileOrchestratorInput.encode(
      {
        newProfile: createdProfile,
        updatedAt: new Date()
      }
    );

    const dfClient = df.getClient(context);
    await dfClient.startNew(
      "UpsertedProfileOrchestratorV2",
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
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function CreateProfile(
  profileModel: ProfileModel,
  optOutEmailSwitchDate: Date
): express.RequestHandler {
  const handler = CreateProfileHandler(profileModel, optOutEmailSwitchDate);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    NewProfileMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
