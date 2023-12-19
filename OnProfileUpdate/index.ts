import { Context } from "@azure/functions";
import { pipe } from "fp-ts/lib/function";
import { TableClient, AzureNamedKeyCredential } from "@azure/data-tables";
import { getConfigOrThrow } from "../utils/config";
import { handler } from "./handler";
import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";
import {
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { CosmosClient } from "@azure/cosmos";

const config = getConfigOrThrow();

const credential = new AzureNamedKeyCredential(
  config.AZURE_STORAGE_ACCOUNT_NAME,
  config.AZURE_STORAGE_ACCOUNT_KEY
);

const tableClient = new TableClient(
  `https://${config.AZURE_STORAGE_ACCOUNT_NAME}.table.core.windows.net`,
  "profileEmails",
  credential
);

const cosmosdbClient = new CosmosClient({
  endpoint: config.COSMOSDB_URI,
  key: config.COSMOSDB_KEY
});

const cosmosdbInstance = cosmosdbClient.database(config.COSMOSDB_NAME);

const profileModel = new ProfileModel(
  cosmosdbInstance.container(PROFILE_COLLECTION_NAME)
);

const dataTableProfileEmailsRepository = new DataTableProfileEmailsRepository(
  tableClient
);

export default async (
  { log }: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> => {
  await pipe(
    {
      dataTableProfileEmailsRepository,
      profileModel,
      logger: { error: log.error }
    },
    handler(documents)
  );
};
