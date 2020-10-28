import * as express from "express";

import { Context } from "@azure/functions";
import { isLeft } from "fp-ts/lib/Either";

import {
  IResponseErrorConflict,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessAccepted,
  ResponseErrorConflict,
  ResponseErrorNotFound,
  ResponseSuccessAccepted
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

import { isNone } from "fp-ts/lib/Option";
import { UserDataProcessingChoiceEnum } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatusEnum } from "io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import {
  makeUserDataProcessingId,
  UserDataProcessingModel
} from "io-functions-commons/dist/src/models/user_data_processing";

type IAbortUserDataProcessingDeleteHandlerResult =
  | IResponseSuccessAccepted
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorQuery
  | IResponseErrorConflict;

/**
 * Type of an AbortUserDataProcessingDelete handler.
 */
type IAbortUserDataProcessingDeleteHandler = (
  context: Context,
  fiscalCode: FiscalCode
) => Promise<IAbortUserDataProcessingDeleteHandlerResult>;

export function AbortUserDataProcessingDeleteHandler(
  userDataProcessingModel: UserDataProcessingModel
): IAbortUserDataProcessingDeleteHandler {
  return async (context, fiscalCode) => {
    const id = makeUserDataProcessingId(
      UserDataProcessingChoiceEnum.DELETE,
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

    if (isNone(maybeRetrievedUserDataProcessing)) {
      return ResponseErrorNotFound(
        "Not Found",
        `Cannot find any DELETE request for user ${fiscalCode}`
      );
    }
    const retrievedUserDataProcessing = maybeRetrievedUserDataProcessing.value;
    if (
      ![
        UserDataProcessingStatusEnum.PENDING,
        UserDataProcessingStatusEnum.ABORTED
      ].includes(retrievedUserDataProcessing.status)
    ) {
      return ResponseErrorConflict(
        `Cannot abort the request because its current status is ${retrievedUserDataProcessing.status}`
      );
    }

    return userDataProcessingModel
      .update({
        ...retrievedUserDataProcessing,
        status: UserDataProcessingStatusEnum.ABORTED
      })
      .fold<IAbortUserDataProcessingDeleteHandlerResult>(
        error => ResponseErrorQuery("Failed to save the entity", error),
        _ => ResponseSuccessAccepted()
      )
      .run();
  };
}

/**
 * Wraps an AbortUserDataProcessingDelete handler inside an Express request handler.
 */
export function AbortUserDataProcessingDelete(
  userDataProcessingModel: UserDataProcessingModel
): express.RequestHandler {
  const handler = AbortUserDataProcessingDeleteHandler(userDataProcessingModel);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
