import * as express from "express";
import * as t from "io-ts";

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
import { fromEither, fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import {
  UserDataProcessingChoice,
  UserDataProcessingChoiceEnum
} from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatusEnum } from "io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import {
  makeUserDataProcessingId,
  RetrievedUserDataProcessing,
  UserDataProcessingModel
} from "io-functions-commons/dist/src/models/user_data_processing";
import { RequiredParamMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_param";
import { readableReport } from "italia-ts-commons/lib/reporters";

/**
 * Defines the subset of UserDataProcessing entities which can be aborted
 */
type AbortableUserDataProcessing = t.TypeOf<typeof AbortableUserDataProcessing>;
const AbortableUserDataProcessing = t.intersection([
  RetrievedUserDataProcessing,
  t.interface({
    // abort makes sense only for DELETE as DOWNLOAD is processed straight away
    choice: t.literal(UserDataProcessingChoiceEnum.DELETE),
    status: t.union([
      t.literal(UserDataProcessingStatusEnum.PENDING),
      t.literal(UserDataProcessingStatusEnum.ABORTED)
    ])
  })
]);

/**
 * Possible returned values of the handler
 */
type IAbortUserDataProcessingHandlerResult =
  | IResponseSuccessAccepted
  | IResponseErrorValidation
  | IResponseErrorNotFound
  | IResponseErrorQuery
  | IResponseErrorConflict;

/**
 * Type of an AbortUserDataProcessing handler.
 */
type IAbortUserDataProcessingHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  choice: UserDataProcessingChoice
) => Promise<IAbortUserDataProcessingHandlerResult>;

export function AbortUserDataProcessingHandler(
  userDataProcessingModel: UserDataProcessingModel
): IAbortUserDataProcessingHandler {
  return async (_, fiscalCode, choice) => {
    const id = makeUserDataProcessingId(choice, fiscalCode);

    return (
      // retrieve the eventual previous delete request
      userDataProcessingModel
        .findLastVersionByModelId([id, fiscalCode])
        .mapLeft<IAbortUserDataProcessingHandlerResult>(
          errorUserDataProcessing =>
            ResponseErrorQuery(
              "Error while retrieving a previous version of user data processing",
              errorUserDataProcessing
            )
        )
        // check we have a previous request to abort
        .chain(maybeRetrievedUserDataProcessing =>
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
        .chain(retrievedUserDataProcessing =>
          fromEither(
            AbortableUserDataProcessing.decode(retrievedUserDataProcessing)
          ).mapLeft(errors =>
            ResponseErrorConflict(
              `Cannot abort the request because: ${readableReport(errors)}`
            )
          )
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
export function AbortUserDataProcessing(
  userDataProcessingModel: UserDataProcessingModel
): express.RequestHandler {
  const handler = AbortUserDataProcessingHandler(userDataProcessingModel);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("choice", UserDataProcessingChoice)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
