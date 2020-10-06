/* tslint:disable:no-any */
// tslint:disable-next-line: no-object-mutation
process.env = {
  ...process.env,
  QueueStorageConnection: "foobar",
  MESSAGE_CONTAINER_NAME: "msg",
  SUBSCRIPTIONS_FEED_TABLE: "feed",
  CUSTOMCONNSTR_COSMOSDB_KEY: "key",
  CUSTOMCONNSTR_COSMOSDB_URI: "uri",
  COSMOSDB_NAME: "cosmoname",
  COSMOSDB_URI: "uri",
  AZURE_NH_ENDPOINT:
    "Endpoint=sb://anendpoint.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=C4xIzNZv4VrUnu5jkmPH635MApRUj8wABky8VfduYqg=",
  AZURE_NH_HUB_NAME: "AZURE_NH_HUB_NAME",
  COSMOSDB_KEY: "key",
  FUNCTIONS_PUBLIC_URL: "url",
  PUBLIC_API_URL: "url",
  PUBLIC_API_KEY: "key",
  MAILHOG_HOSTNAME: "mailhog",
  MAIL_FROM: "mail@example.it",
  NODE_ENV: "dev",
  REQ_SERVICE_ID: "req_id_dev",
  SPID_LOGS_PUBLIC_KEY: "key"
};
import { NonEmptyString } from "italia-ts-commons/lib/strings";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { PlatformEnum } from "../../generated/backend/Platform";
import {
  CreateOrUpdateInstallationMessage,
  KindEnum as CreateOrUpdateInstallationKind
} from "../../generated/notifications/CreateOrUpdateInstallationMessage";
import {
  ActivityInput as NHCallServiceActivityInput,
  ActivityResult
} from "../../HandleNHNotificationCallActivity/handler";
import { handler, NhNotificationOrchestratorInput } from "../handler";

const aFiscalCodeHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as NonEmptyString;
const aPushChannel =
  "fLKP3EATnBI:APA91bEy4go681jeSEpLkNqhtIrdPnEKu6Dfi-STtUiEnQn8RwMfBiPGYaqdWrmzJyXIh5Yms4017MYRS9O1LGPZwA4sOLCNIoKl4Fwg7cSeOkliAAtlQ0rVg71Kr5QmQiLlDJyxcq3p";
const aNotificationHubMessage: CreateOrUpdateInstallationMessage = {
  installationId: aFiscalCodeHash,
  kind: CreateOrUpdateInstallationKind.CreateOrUpdateInstallation,
  platform: PlatformEnum.apns,
  pushChannel: aPushChannel,
  tags: [aFiscalCodeHash]
};

const retryOptions = {
  backoffCoefficient: 1.5
};

describe("HandleNHNotificationCallOrchestrator", () => {
  it("should start the activities with the right inputs", async () => {
    const nhCallOrchestratorInput = NhNotificationOrchestratorInput.encode({
      message: aNotificationHubMessage
    });

    const callNHServiceActivityResult = ActivityResult.encode({
      kind: "SUCCESS"
    });

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(callNHServiceActivityResult),
        getInput: jest.fn(() => nhCallOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivityWithRetry).toBeCalledWith(
      "HandleNHNotificationCallActivity",
      retryOptions,
      NHCallServiceActivityInput.encode({
        message: aNotificationHubMessage
      })
    );
  });

  it("should not start activity with wrong inputs", async () => {
    const nhCallOrchestratorInput = {
      message: "aMessage"
    };

    const callNHServiceActivityResult = ActivityResult.encode({
      kind: "SUCCESS"
    });

    const contextMockWithDf = {
      ...contextMock,
      df: {
        callActivityWithRetry: jest
          .fn()
          .mockReturnValueOnce(callNHServiceActivityResult),
        getInput: jest.fn(() => nhCallOrchestratorInput)
      }
    };

    const orchestratorHandler = handler(contextMockWithDf as any);

    orchestratorHandler.next();

    expect(contextMockWithDf.df.callActivityWithRetry).not.toBeCalled();
  });
});
