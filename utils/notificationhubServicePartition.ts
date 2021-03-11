import { NewUserDataProcessing } from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { Option, some } from "fp-ts/lib/Option";
import { getConfigOrThrow } from "./config";
import { ExtendedNotificationHubService } from "./notification";

export function getNHService(
  fiscalCodeHash: string,
  attempt: number = 1
): Option<ExtendedNotificationHubService> {
  return some(createNH0Service());
}

export function createNH0Service(): ExtendedNotificationHubService {
  const config = getConfigOrThrow();

  return new ExtendedNotificationHubService(
    config.AZURE_NH_HUB_NAME,
    config.AZURE_NH_ENDPOINT
  );
}
