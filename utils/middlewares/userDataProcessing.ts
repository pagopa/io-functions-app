import { ResponseErrorFromValidationErrors } from "italia-ts-commons/lib/responses";

import { UserDataProcessingChoiceRequest } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoiceRequest";
import {
  NewUserDataProcessing,
  UserDataProcessing
} from "io-functions-commons/dist/src/models/user_data_processing";
import { IRequestMiddleware } from "io-functions-commons/dist/src/utils/request_middleware";

/**
 * A middleware that extracts a NewUserDataProcessing payload from a request.
 */
export const NewUserDataProcessingMiddleware: IRequestMiddleware<
  "IResponseErrorValidation",
  NewUserDataProcessing
> = request =>
  Promise.resolve(
    NewUserDataProcessing.decode(request.body).mapLeft(
      ResponseErrorFromValidationErrors(NewUserDataProcessing)
    )
  );

/**
 * A middleware that extracts a UserDataProcessingChoice payload from a request.
 */
export const UserDataProcessingChoiceMiddleware: IRequestMiddleware<
  "IResponseErrorValidation",
  UserDataProcessingChoiceRequest
> = request => {
  return Promise.resolve(
    UserDataProcessingChoiceRequest.decode(request.body).mapLeft(
      ResponseErrorFromValidationErrors(UserDataProcessingChoiceRequest)
    )
  );
};

/**
 * A middleware that extracts a UserDataProcessing payload from a request.
 */
export const UserDataProcessingMiddleware: IRequestMiddleware<
  "IResponseErrorValidation",
  UserDataProcessing
> = request =>
  Promise.resolve(
    UserDataProcessing.decode(request.body).mapLeft(
      ResponseErrorFromValidationErrors(UserDataProcessing)
    )
  );
