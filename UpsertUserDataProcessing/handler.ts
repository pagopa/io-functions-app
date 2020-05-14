import * as express from "express";

import { Context } from "@azure/functions";
import * as df from "durable-functions";
import { Either, isLeft, left, right } from "fp-ts/lib/Either";

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
} from "io-functions-commons/dist/src/utils/response";

import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";

import { UserDataProcessing as UserDataProcessingApi } from "io-functions-commons/dist/generated/definitions/UserDataProcessing";
import { UserDataProcessingChoiceRequest } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoiceRequest";
import { UserDataProcessingStatusEnum } from "io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import {
  makeUserDataProcessingId,
  UserDataProcessing,
  UserDataProcessingModel
} from "io-functions-commons/dist/src/models/user_data_processing";
import { RequiredBodyPayloadMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import { OrchestratorInput } from "../UpsertedUserDataProcessingOrchestrator/handler";
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

    const errorOrMaybeRetrievedUserDataProcessing = await userDataProcessingModel.findOneUserDataProcessingById(
      fiscalCode,
      id
    );

    // compute the request status according to its previous value (when found)
    // This is the machine state table implemented by following code:
    // |current	         |  POST
    // |undefined / none |  PENDING
    // |PENDING	         |  Conflict Error
    // |WIP	             |  Conflict Error
    // |CLOSED           |  PENDING
    if (isLeft(errorOrMaybeRetrievedUserDataProcessing)) {
      return ResponseErrorQuery(
        "Error while retrieving a previous version of user data processing",
        errorOrMaybeRetrievedUserDataProcessing.value
      );
    }
    const maybeRetrievedUserDataProcessing =
      errorOrMaybeRetrievedUserDataProcessing.value;
    const errorOrComputedStatus = maybeRetrievedUserDataProcessing.fold<
      Either<string, UserDataProcessingStatusEnum>
    >(right(UserDataProcessingStatusEnum.PENDING), retrieved => {
      return retrieved.status === UserDataProcessingStatusEnum.CLOSED
        ? right(UserDataProcessingStatusEnum.PENDING)
        : left("Another request is already PENDING or WIP for this User");
    });

    return errorOrComputedStatus.fold<
      Promise<
        | IResponseSuccessJson<UserDataProcessingApi>
        | IResponseErrorQuery
        | IResponseErrorConflict
      >
    >(
      async conflictErrorMessage => ResponseErrorConflict(conflictErrorMessage),
      async computedStatus => {
        const userDataProcessing: UserDataProcessing = {
          choice: upsertUserDataProcessingPayload.choice,
          createdAt: new Date(),
          fiscalCode,
          status: computedStatus,
          userDataProcessingId: id
        };
        const errorOrUpsertedUserDataProcessing = await userDataProcessingModel.createOrUpdateByNewOne(
          userDataProcessing
        );
        if (isLeft(errorOrUpsertedUserDataProcessing)) {
          const { body } = errorOrUpsertedUserDataProcessing.value;

          context.log.error(`${logPrefix}|ERROR=${body}`);

          return ResponseErrorQuery(
            "Error while creating a new user data processing",
            errorOrUpsertedUserDataProcessing.value
          );
        }

        const createdOrUpdatedUserDataProcessing =
          errorOrUpsertedUserDataProcessing.value;

        const upsertedUserDataProcessingOrchestratorInput = OrchestratorInput.encode(
          {
            choice: createdOrUpdatedUserDataProcessing.choice,
            fiscalCode
          }
        );
        await df
          .getClient(context)
          .startNew(
            "UpsertedUserDataProcessingOrchestrator",
            undefined,
            upsertedUserDataProcessingOrchestratorInput
          );
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
