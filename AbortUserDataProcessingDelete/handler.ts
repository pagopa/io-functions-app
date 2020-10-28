import * as express from "express";

import { Context } from "@azure/functions";

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

import { identity } from "fp-ts/lib/function";
import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { UserDataProcessing } from "io-functions-commons/dist/generated/definitions/UserDataProcessing";
import { UserDataProcessingChoiceEnum } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatusEnum } from "io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import {
  makeUserDataProcessingId,
  RetrievedUserDataProcessing,
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

const canBeAborted = (udp: UserDataProcessing): boolean =>
  [
    UserDataProcessingStatusEnum.PENDING,
    UserDataProcessingStatusEnum.ABORTED
  ].includes(udp.status);

export function AbortUserDataProcessingDeleteHandler(
  userDataProcessingModel: UserDataProcessingModel
): IAbortUserDataProcessingDeleteHandler {
  return async (_, fiscalCode) => {
    const id = makeUserDataProcessingId(
      UserDataProcessingChoiceEnum.DELETE,
      fiscalCode
    );

    return (
      // retrieve the eventual previous delete request
      userDataProcessingModel
        .findLastVersionByModelId([id, fiscalCode])
        .mapLeft<IAbortUserDataProcessingDeleteHandlerResult>(
          errorUserDataProcessing =>
            ResponseErrorQuery(
              "Error while retrieving a previous version of user data processing",
              errorUserDataProcessing
            )
        )
        // check we have a previous request to abort
        .chain<RetrievedUserDataProcessing>(maybeRetrievedUserDataProcessing =>
          maybeRetrievedUserDataProcessing.fold(
            fromLeft(
              ResponseErrorNotFound(
                "Not Found",
                `Cannot find any DELETE request for user ${fiscalCode}`
              )
            ),
            value => taskEither.of(value)
          )
        )
        // check the request can be aborted
        .chain<RetrievedUserDataProcessing>(retrievedUserDataProcessing =>
          !canBeAborted(retrievedUserDataProcessing)
            ? fromLeft(
                ResponseErrorConflict(
                  `Cannot abort the request because its current status is ${retrievedUserDataProcessing.status}`
                )
              )
            : taskEither.of(retrievedUserDataProcessing)
        )
        // finally save the abortion
        .chain(retrievedUserDataProcessing =>
          userDataProcessingModel
            .update({
              ...retrievedUserDataProcessing,
              status: UserDataProcessingStatusEnum.ABORTED
            })
            .mapLeft(error =>
              ResponseErrorQuery("Failed to save the entity", error)
            )
        )
        .fold(identity, __ => ResponseSuccessAccepted())
        .run()
    );
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
