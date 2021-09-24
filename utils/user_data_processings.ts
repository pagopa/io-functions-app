import { UserDataProcessing } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessing";
import { RetrievedUserDataProcessing } from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";

/**
 * Converts a RetrievedUserDataProcessing model to an UserDataProcessing
 */
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function toUserDataProcessingApi(
  userDataProcessing: RetrievedUserDataProcessing
): UserDataProcessing {
  return {
    choice: userDataProcessing.choice,
    created_at: userDataProcessing.createdAt,
    status: userDataProcessing.status,
    updated_at: userDataProcessing.updatedAt,
    version: userDataProcessing.version
  };
}
