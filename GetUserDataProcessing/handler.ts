import * as express from "express";

import { Context } from "@azure/functions";

import { isLeft } from "fp-ts/lib/Either";

import {
  IResponseErrorConflict,
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorNotFound
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

import { isSome } from "fp-ts/lib/Option";
import { UserDataProcessingChoice } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import {
  UserDataProcessing,
  UserDataProcessingModel
} from "io-functions-commons/dist/src/models/user_data_processing";
import { RequiredParamMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_param";

/**
 * Type of an GetUserDataProcessing handler.
 */
type IGetUserDataProcessingHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  userDataProcessingChoice: UserDataProcessingChoice
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseSuccessJson<UserDataProcessing>
  | IResponseErrorQuery
  | IResponseErrorNotFound
  | IResponseErrorConflict
>;

export function GetUserDataProcessingHandler(
  userDataProcessingModel: UserDataProcessingModel
): IGetUserDataProcessingHandler {
  return async (context, fiscalCode, choice) => {
    const logPrefix = `GetUserDataProcessingHandler|FISCAL_CODE=${fiscalCode}`;

    context.log.info(`fiscalCode = ${fiscalCode}`);
    context.log.info(`choice = ${choice}`);
    context.log.info("prima di query GetUserDataProcessing");

    const maybeResultOrError = await userDataProcessingModel.findAllByFiscalCodeAndChoice(
      fiscalCode,
      choice
    );

    if (isLeft(maybeResultOrError)) {
      const { code, body } = maybeResultOrError.value;

      context.log.error(`${logPrefix}|ERROR=${body}`);
      if (code === 404) {
        return ResponseErrorNotFound(
          "Not Found while retrieving User Data Processing",
          `${body}`
        );
      } else {
        return ResponseErrorQuery(
          "Error while retrieving a user data processing",
          maybeResultOrError.value
        );
      }
    }

    const maybeUserDataProcessing = maybeResultOrError.value;
    if (isSome(maybeUserDataProcessing)) {
      const userDataProc = maybeUserDataProcessing.value;
      return ResponseErrorNotFound(
        "found",
        `userDataProc = ${userDataProc.id}`
      );
    } else {
      return ResponseErrorNotFound(
        "Error while retrieving user data processing",
        "Not Found"
      );
    }
  };
}

/**
 * Wraps a GetUserDataProcessing handler inside an Express request handler.
 */
export function GetUserDataProcessing(
  userDataProcessingModel: UserDataProcessingModel
): express.RequestHandler {
  const handler = GetUserDataProcessingHandler(userDataProcessingModel);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    RequiredParamMiddleware("choice", UserDataProcessingChoice)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
