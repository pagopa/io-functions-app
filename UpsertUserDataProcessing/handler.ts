import * as express from "express";

import { Context } from "@azure/functions";
import * as df from "durable-functions";
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
} from "io-functions-commons/dist/src/utils/response";

import { ContextMiddleware } from "io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { FiscalCodeMiddleware } from "io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "io-functions-commons/dist/src/utils/request_middleware";

import { none, some } from "fp-ts/lib/Option";
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
      _ =>
        // create a new PENDING request in case the last request
        // of the same type is CLOSED or ABORTED
        _.status === UserDataProcessingStatusEnum.CLOSED || _.status === UserDataProcessingStatusEnum.ABORTED
          ? some(UserDataProcessingStatusEnum.PENDING)
          : // do not create a new request in all other cases
          none
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
