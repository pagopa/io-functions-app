import { Context } from "@azure/functions";

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
import { UserDataProcessingChoice } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import {
  makeUserDataProcessingId,
  UserDataProcessingModel
} from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { RequiredParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_param";

import * as express from "express";

import { isLeft } from "fp-ts/lib/Either";
import { isSome } from "fp-ts/lib/Option";

import {
  IResponseErrorNotFound,
  IResponseSuccessJson,
  ResponseErrorNotFound,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { toUserDataProcessingApi } from "../utils/user_data_processings";

/**
 * Type of a GetUserDataProcessing handler.
 */
type IGetUserDataProcessingHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  userDataProcessingChoice: UserDataProcessingChoice
) => Promise<
  | IResponseSuccessJson<UserDataProcessingApi>
  | IResponseErrorQuery
  | IResponseErrorNotFound
>;

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function GetUserDataProcessingHandler(
  userDataProcessingModel: UserDataProcessingModel
): IGetUserDataProcessingHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async (context, fiscalCode, choice) => {
    const logPrefix = `GetUserDataProcessingHandler|FISCAL_CODE=${fiscalCode}`;
    const id = makeUserDataProcessingId(choice, fiscalCode);
    const maybeResultOrError = await userDataProcessingModel.findLastVersionByModelId(
      [id, fiscalCode]
    )();
    if (isLeft(maybeResultOrError)) {
      const failure = maybeResultOrError.left;

      context.log.error(`${logPrefix}|ERROR=${failure.kind}`);
      if (
        failure.kind === "COSMOS_ERROR_RESPONSE" &&
        failure.error.code === 404
      ) {
        return ResponseErrorNotFound(
          "Not Found while retrieving User Data Processing",
          `${failure.error.message}`
        );
      } else {
        return ResponseErrorQuery(
          "Error while retrieving a user data processing",
          failure
        );
      }
    }

    const maybeUserDataProcessing = maybeResultOrError.right;
    if (isSome(maybeUserDataProcessing)) {
      const userDataProc = maybeUserDataProcessing.value;
      return ResponseSuccessJson(toUserDataProcessingApi(userDataProc));
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
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
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
