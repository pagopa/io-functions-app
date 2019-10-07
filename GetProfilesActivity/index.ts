import * as crypto from "crypto";

import * as t from "io-ts";

import { AzureFunction, Context } from "@azure/functions";
import { createTableService, TableUtilities } from "azure-storage";

import { readableReport } from "italia-ts-commons/lib/reporters";
import { FiscalCode } from "italia-ts-commons/lib/strings";

import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";

import { ServiceId } from "io-functions-commons/dist/generated/definitions/ServiceId";

import { DocumentClient as DocumentDBClient } from "documentdb";

import {
  PROFILE_COLLECTION_NAME,
  ProfileModel,
  Profile,
  RetrievedProfile
} from "io-functions-commons/dist/src/models/profile";

import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";

const cosmosDbUri = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
const cosmosDbKey = getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");
const cosmosDbName = getRequiredStringEnv("COSMOSDB_NAME");

const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const profilesCollectionUrl = documentDbUtils.getCollectionUri(
  documentDbDatabaseUrl,
  PROFILE_COLLECTION_NAME
);

const documentClient = new DocumentDBClient(cosmosDbUri, {
  masterKey: cosmosDbKey
});

const profileModel = new ProfileModel(documentClient, profilesCollectionUrl);

type ProfileVersions = Partial<{
  first: RetrievedProfile;
  last: RetrievedProfile;
}>;

// result of reduced collection, for each fiscal code we have the first and the
// last version of the associated profile
type AccCollection = Partial<{
  readonly [key: string]: Partial<ProfileVersions>;
}>;

const activityFunction: AzureFunction = async (
  context: Context
): Promise<string> => {
  // an iterator for all items in the profile collection
  const profileCollectionIterator = await profileModel.getCollectionIterator();

  context.log.verbose("GetProfilesActivity|Fetching profiles");

  // foldable iterator that reduces the collection to the first and latest
  // version for each profile
  const foldableIterator = documentDbUtils.reduceResultIterator<
    RetrievedProfile,
    AccCollection
  >(profileCollectionIterator, (acc, oneProfile) => {
    const { fiscalCode, version } = oneProfile;
    if (version === 0) {
      // handle profile creation
      const accProfileVersions = acc[fiscalCode] || {};
      // set current profile as first version
      const updatedProfileVersions = {
        ...accProfileVersions,
        first: oneProfile
      };
      return {
        ...acc,
        [fiscalCode]: updatedProfileVersions
      };
    } else {
      // handle profile updates
      const accProfileVersions = acc[fiscalCode] || {};
      if (
        accProfileVersions.last &&
        accProfileVersions.last.version > oneProfile.version
      ) {
        // this profile update is older then the most recent we've seen so far
        return acc;
      }
      // set current profile as last version
      const updatedProfileVersions = {
        ...accProfileVersions,
        last: oneProfile
      };
      return {
        ...acc,
        [fiscalCode]: updatedProfileVersions
      };
    }
  });

  const result = await documentDbUtils.iteratorToValue(
    foldableIterator,
    {} as AccCollection
  );

  return JSON.stringify(result, undefined, 2);

  // return "SUCCESS";
};

export default activityFunction;
