import * as express from "express";

import { Context } from "@azure/functions";
import { isLeft } from "fp-ts/lib/Either";

import {
  IResponseErrorConflict,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { FiscalCode } from "italia-ts-commons/lib/strings";

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

import { none, some } from "fp-ts/lib/Option";
import { fromEither } from "fp-ts/lib/TaskEither";
import { UserDataProcessing as UserDataProcessingApi } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessing";
import { UserDataProcessingChoiceRequest } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingChoiceRequest";
import { UserDataProcessingStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import {
  makeUserDataProcessingId,
  NewUserDataProcessing,
  UserDataProcessing,
  UserDataProcessingModel
} from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import {
  CosmosDecodingError,
  CosmosErrors
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
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
  // tslint:disable-next-line: max-union-size
  | IResponseSuccessJson<UserDataProcessingApi>
  | IResponseErrorValidation
  | IResponseErrorQuery
  | IResponseErrorConflict
>;

export function UpsertUserDataProcessingHandler(
  userDataProcessingModel: UserDataProcessingModel
): IUpsertUserDataProcessingHandler {
  return async (context, fiscalCode, upsertUserDataProcessingPayload) => {
    const logPrefix = `UpsertUserDataProcessingHandler|FISCAL_CODE=${
      fiscalCode === undefined ? undefined : fiscalCode.substring(0, 5)
    }`;
    const id = makeUserDataProcessingId(
      upsertUserDataProcessingPayload.choice,
      fiscalCode
    );

    const errorOrMaybeRetrievedUserDataProcessing = await userDataProcessingModel
      .findLastVersionByModelId([id, fiscalCode])
      .run();

    if (isLeft(errorOrMaybeRetrievedUserDataProcessing)) {
      return ResponseErrorQuery(
        "Error while retrieving a previous version of user data processing",
        errorOrMaybeRetrievedUserDataProcessing.value
      );
    }
    const maybeRetrievedUserDataProcessing =
      errorOrMaybeRetrievedUserDataProcessing.value;

    const maybeNewStatus = maybeRetrievedUserDataProcessing.fold(
      // create a new PENDING request in case this is the first request
      some(UserDataProcessingStatusEnum.PENDING),
      ({ status }) =>
        // if the request is currently on going, don't create another
        UserDataProcessingStatusEnum.PENDING === status ||
        UserDataProcessingStatusEnum.WIP === status
          ? none
          : some(UserDataProcessingStatusEnum.PENDING)
    );

    return maybeNewStatus.foldL<
      Promise<
        | IResponseSuccessJson<UserDataProcessingApi>
        | IResponseErrorQuery
        | IResponseErrorConflict
      >
    >(
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
        const errorOrUpsertedUserDataProcessing = await fromEither(
          NewUserDataProcessing.decode({
            ...userDataProcessing,
            kind: "INewUserDataProcessing"
          })
        )
          .mapLeft<CosmosErrors>(CosmosDecodingError)
          .chain(_ => userDataProcessingModel.upsert(_))
          .run();

        if (isLeft(errorOrUpsertedUserDataProcessing)) {
          const failure = errorOrUpsertedUserDataProcessing.value;

          context.log.error(`${logPrefix}|ERROR=${failure.kind}`);

          return ResponseErrorQuery(
            "Error while creating a new user data processing",
            errorOrUpsertedUserDataProcessing.value
          );
        }

        const createdOrUpdatedUserDataProcessing =
          errorOrUpsertedUserDataProcessing.value;

        return ResponseSuccessJson(
          toUserDataProcessingApi(createdOrUpdatedUserDataProcessing)
        );
      }
    );
  };
}

/**
 * Wraps an UpsertUserDataProcessing handler inside an Express request handler.
 */
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
