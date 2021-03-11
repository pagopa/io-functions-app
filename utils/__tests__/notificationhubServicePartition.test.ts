import { isSome } from "fp-ts/lib/Option";
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { getNHService } from "../notificationhubServicePartition";

import * as config from "../config";

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as NonEmptyString;

const AZURE_NH_ENDPOINT = "Endpoint=sb://127.0.0.1:30000;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=foobar" as NonEmptyString;
const AZURE_NH_HUB_NAME = "io-notification-hub-mock" as NonEmptyString;

const c = config.getConfigOrThrow();

jest.spyOn(config, "getConfigOrThrow").mockImplementation(() => {
  return {
    ...c,
    AZURE_NH_ENDPOINT,
    AZURE_NH_HUB_NAME
  };
});

describe("NotificationHubServicepartition", () => {
  it("should return always NH0 Service", () => {
    const NH0Option = getNHService(aFiscalCodeHash);

    expect(isSome(NH0Option)).toBeTruthy();

    if (isSome(NH0Option)) {
      expect(NH0Option.value.hubName).toBe(AZURE_NH_HUB_NAME);
    }
  });
});
