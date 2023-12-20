import { Context } from "@azure/functions";
import { pipe } from "fp-ts/lib/function";
import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";
import {
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { profileEmailTableClient } from "../utils/unique_email_enforcement";
import { handler } from "./handler";

const profileModel = new ProfileModel(
  cosmosdbInstance.container(PROFILE_COLLECTION_NAME)
);

const dataTableProfileEmailsRepository = new DataTableProfileEmailsRepository(
  profileEmailTableClient
);

export default async (
  { log }: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> => {
  await pipe(
    {
      dataTableProfileEmailsRepository,
      logger: { error: log.error },
      profileModel
    },
    handler(documents)
  );
};
