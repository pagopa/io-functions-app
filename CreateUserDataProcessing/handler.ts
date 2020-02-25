import * as express from "express";

import { Context } from "@azure/functions";

import { isLeft } from "fp-ts/lib/Either";

import {
  IResponseErrorConflict,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorFromValidationErrors,
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

import { UserDataProcessingChoiceRequest } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoiceRequest";
import { UserDataProcessingStatusEnum } from "io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import {
  makeUserDataProcessingId,
  UserDataProcessing,
  UserDataProcessingModel
} from "io-functions-commons/dist/src/models/user_data_processing";
import { UserDataProcessingChoiceMiddleware } from "../utils/middlewares/userDataProcessing";

/**
 * Type of an CreateProfile handler.
 */
type ICreateUserDataProcessingHandler = (
  context: Context,
  fiscalCode: FiscalCode,
  userDataProcessingChoiceRequest: UserDataProcessingChoiceRequest
) => Promise<
  // tslint:disable-next-line: max-union-size
  | IResponseSuccessJson<UserDataProcessing>
  | IResponseErrorValidation
  | IResponseErrorQuery
  | IResponseErrorConflict
>;

export function CreateUserDataProcessingHandler(
  userDataProcessingModel: UserDataProcessingModel
): ICreateUserDataProcessingHandler {
  return async (context, fiscalCode, createUserDataProcessingPayload) => {
    const logPrefix = `CreateUserDataProcessingHandler|FISCAL_CODE=${fiscalCode}`;
    const id = makeUserDataProcessingId(
      createUserDataProcessingPayload.choice,
      fiscalCode
    );
    const userDataProcessing = UserDataProcessing.decode({
      choice: createUserDataProcessingPayload.choice,
      createdAt: new Date(),
      fiscalCode,
      status: UserDataProcessingStatusEnum.PENDING,
      userDataProcessingId: id
    });

    if (isLeft(userDataProcessing)) {
      const error = userDataProcessing.value;
      return ResponseErrorFromValidationErrors(UserDataProcessing)(error);
    } else {
      const errorOrCreatedUserDataProcessing = await userDataProcessingModel.createOrUpdateByNewOne(
        userDataProcessing.value
      );

      context.log.error(
        `errorOrCreatedUserDataProcessing ${errorOrCreatedUserDataProcessing}`
      );
      if (isLeft(errorOrCreatedUserDataProcessing)) {
        const { body } = errorOrCreatedUserDataProcessing.value;

        context.log.error(`${logPrefix}|ERROR=${body}`);

        return ResponseErrorQuery(
          "Error while creating a new user data processing",
          errorOrCreatedUserDataProcessing.value
        );
      }

      const createdOrUpdatedUserDataProcessing =
        errorOrCreatedUserDataProcessing.value;
      return ResponseSuccessJson(createdOrUpdatedUserDataProcessing);
    }
  };
}

/**
 * Wraps an CreateProfile handler inside an Express request handler.
 */
export function CreateUserDataProcessing(
  userDataProcessingModel: UserDataProcessingModel
): express.RequestHandler {
  const handler = CreateUserDataProcessingHandler(userDataProcessingModel);

  const middlewaresWrap = withRequestMiddlewares(
    ContextMiddleware(),
    FiscalCodeMiddleware,
    UserDataProcessingChoiceMiddleware
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}
