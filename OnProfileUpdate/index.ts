import { Context } from "@azure/functions";
import { pipe } from "fp-ts/lib/function";
import * as E from "fp-ts/lib/Either";
import {
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";
import { cosmosdbInstance } from "../utils/cosmosdb";
import { profileEmailTableClient } from "../utils/unique_email_enforcement";
import { initTelemetryClient } from "../utils/appinsights";
import { handler } from "./handler";

const profileModel = new ProfileModel(
  cosmosdbInstance.container(PROFILE_COLLECTION_NAME)
);

const dataTableProfileEmailsRepository = new DataTableProfileEmailsRepository(
  profileEmailTableClient
);

const telemetryClient = initTelemetryClient();

export default async (
  _context: Context,
  documents: ReadonlyArray<unknown>
): Promise<void> => {
  await pipe(
    {
      dataTableProfileEmailsRepository,
      profileModel,
      telemetryClient
    },
    handler(documents)
  )().then(result => {
    for (const item of result) {
      if (E.isLeft(item)) {
        throw item.left;
      }
    }
  });
};
