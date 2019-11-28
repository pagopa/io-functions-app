import * as t from "io-ts";

import { isLeft } from "fp-ts/lib/Either";
import { fromNullable, isNone } from "fp-ts/lib/Option";

import { Context } from "@azure/functions";

import * as documentDbUtils from "io-functions-commons/dist/src/utils/documentdb";

import {
  ProfileModel,
  RetrievedProfile
} from "io-functions-commons/dist/src/models/profile";

export const ProfilesLatestVersion = t.record(t.string, RetrievedProfile);

export type ProfilesLatestVersion = t.TypeOf<typeof ProfilesLatestVersion>;

export const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

export const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS"),
  value: t.interface({
    profilesLatestVersion: ProfilesLatestVersion
  })
});

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultFailure,
  ActivityResultSuccess
]);

export type ActivityResult = t.TypeOf<typeof ActivityResult>;

/**
 * Returns the latest version of each profile
 */
export const getProfilesLatestVersionActivityHandler = (
  profileModel: ProfileModel
) => async (context: Context, __: unknown): Promise<unknown> => {
  const logPrefix = "GetProfilesLatestVersionActivity";
  try {
    const profilesInterator = await profileModel.getCollectionIterator();

    const errorOrProfiles = await documentDbUtils.iteratorToArray(
      profilesInterator
    );

    if (isLeft(errorOrProfiles)) {
      const error = new Error(
        `${logPrefix}|Error retrieving profiles|ERROR=${errorOrProfiles.value.body}`
      );
      context.log.error();
      // Throw error so the activity is retried
      throw error;
    }

    const profiles = errorOrProfiles.value;

    const profilesLatestVersion = profiles.reduce<ProfilesLatestVersion>(
      (accumulator, profile) => {
        const maybeProfileCurrent = fromNullable(
          accumulator[profile.fiscalCode]
        );

        // If we have no info about the profile associated with the current fiscalCode
        // or the version already stored is older, store the new version in the accumulator.
        if (
          isNone(maybeProfileCurrent) ||
          profile.version > maybeProfileCurrent.value.version
        ) {
          return {
            ...accumulator,
            [profile.fiscalCode]: profile
          };
        }

        return accumulator;
      },
      {}
    );
    return ActivityResultSuccess.encode({
      kind: "SUCCESS",
      value: {
        profilesLatestVersion
      }
    });
  } catch (e) {
    const error = new Error(`${logPrefix}|Activity error|ERROR=${e}`);
    context.log.error(error.message);
    // Throw error so the activity is retried
    throw error;
  }
};
