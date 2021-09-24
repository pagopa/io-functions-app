import * as express from "express";

import { Context } from "@azure/functions";

import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

import {
  IResponseErrorConflict,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

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

import { UserDataProcessing as UserDataProcessingApi } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessing";
import { UserDataProcessingChoiceRequest } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingChoiceRequest";
import { UserDataProcessingStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import {
  makeUserDataProcessingId,
  NewUserDataProcessing,
  UserDataProcessing,
  UserDataProcessingModel
} from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { CosmosDecodingError } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import { toUserDataProcessingApi } from "../utils/user_data_processings";

/**
 * Type of an UpsertUserDataProcessing handler.
 */
type IUpsertUserDataProcessingHandler = (
  context: Context,
  fiscalCode: FiscalCode,

  userDataProcessingChoiceRequest: UserDataProcessingChoiceRequest
) => Promise<
  | IResponseSuccessJson<UserDataProcessingApi>
  | IResponseErrorValidation
  | IResponseErrorQuery
  | IResponseErrorConflict
>;

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function UpsertUserDataProcessingHandler(
  userDataProcessingModel: UserDataProcessingModel
): IUpsertUserDataProcessingHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async (context, fiscalCode, upsertUserDataProcessingPayload) => {
    const logPrefix = `UpsertUserDataProcessingHandler|FISCAL_CODE=${
      fiscalCode === undefined ? undefined : fiscalCode.substring(0, 5)
    }`;
    const id = makeUserDataProcessingId(
      upsertUserDataProcessingPayload.choice,
      fiscalCode
    );

    const errorOrMaybeRetrievedUserDataProcessing = await userDataProcessingModel.findLastVersionByModelId(
      [id, fiscalCode]
    )();

    if (E.isLeft(errorOrMaybeRetrievedUserDataProcessing)) {
      return ResponseErrorQuery(
        "Error while retrieving a previous version of user data processing",
        errorOrMaybeRetrievedUserDataProcessing.left
      );
    }
    const maybeRetrievedUserDataProcessing =
      errorOrMaybeRetrievedUserDataProcessing.right;

    return pipe(
      maybeRetrievedUserDataProcessing,
      O.foldW(
        // create a new PENDING request in case this is the first request
        () => O.some(UserDataProcessingStatusEnum.PENDING),
        ({ status }) =>
          // if the request is currently on going, don't create another
          UserDataProcessingStatusEnum.PENDING === status ||
          UserDataProcessingStatusEnum.WIP === status
            ? O.none
            : O.some(UserDataProcessingStatusEnum.PENDING)
      ),
      O.foldW(
        async () =>
          ResponseErrorConflict(
            "Another request is already PENDING or WIP for this User"
          ),
        async newStatus => {
          const userDataProcessing: UserDataProcessing = {
            choice: upsertUserDataProcessingPayload.choice,
            createdAt: new Date(),
            fiscalCode,
            status: newStatus,
            userDataProcessingId: id
          };
          const errorOrUpsertedUserDataProcessing = await pipe(
            NewUserDataProcessing.decode({
              ...userDataProcessing,
              kind: "INewUserDataProcessing"
            }),
            TE.fromEither,
            TE.mapLeft(CosmosDecodingError),
            TE.chain(valueToUpsert =>
              userDataProcessingModel.upsert(valueToUpsert)
            )
          )();

          if (E.isLeft(errorOrUpsertedUserDataProcessing)) {
            const failure = errorOrUpsertedUserDataProcessing.left;

            context.log.error(`${logPrefix}|ERROR=${failure.kind}`);

            return ResponseErrorQuery(
              "Error while creating a new user data processing",
              errorOrUpsertedUserDataProcessing.left
            );
          }

          const createdOrUpdatedUserDataProcessing =
            errorOrUpsertedUserDataProcessing.right;

          return ResponseSuccessJson(
            toUserDataProcessingApi(createdOrUpdatedUserDataProcessing)
          );
        }
      )
    );
  };
}

/**
 * Wraps an UpsertUserDataProcessing handler inside an Express request handler.
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function UpsertUserDataProcessing(
  userDataProcessingModel: UserDataProcessingModel
): express.RequestHandler {
  const handler = UpsertUserDataProcessingHandler(userDataProcessingModel);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredBodyPayloadMiddleware(UserDataProcessingChoiceRequest)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
