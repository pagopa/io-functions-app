import { UserDataProcessingChoiceRequest } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoiceRequest";
import {
  NewUserDataProcessing,
  UserDataProcessing
} from "io-functions-commons/dist/src/models/user_data_processing";
import { RequiredBodyPayloadMiddleware } from "io-functions-commons/dist/src/utils/middlewares/required_body_payload";
/**
 * A middleware that extracts a NewUserDataProcessing payload from a request.
 */
export const NewUserDataProcessingMiddleware = RequiredBodyPayloadMiddleware(
  NewUserDataProcessing
);

/**
 * A middleware that extracts a UserDataProcessingChoice payload from a request.
 */
export const UserDataProcessingChoiceMiddleware = RequiredBodyPayloadMiddleware(
  UserDataProcessingChoiceRequest
);

/**
 * A middleware that extracts a UserDataProcessing payload from a request.
 */
export const UserDataProcessingMiddleware = RequiredBodyPayloadMiddleware(
  UserDataProcessing
);
