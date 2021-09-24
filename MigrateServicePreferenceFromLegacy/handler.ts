import { Context } from "@azure/functions";
import { BlockedInboxOrChannelEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  makeServicesPreferencesDocumentId,
  NewServicePreference,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import {
  CosmosErrorResponse,
  CosmosErrors
} from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";

import * as A from "fp-ts/lib/Array";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

import * as t from "io-ts";

import { FiscalCode } from "../generated/backend/FiscalCode";
import { ServiceId } from "../generated/backend/ServiceId";
import { errorsToError } from "../utils/conversions";
import { createTracker } from "../utils/tracking";

const COSMOS_ERROR_KIND = "COSMOS_ERROR_RESPONSE";
const CONFLICT_CODE = 409;
const LOG_PREFIX = "MigrateServicePreferenceFromLegacy";

export const MigrateServicesPreferencesQueueMessage = t.interface({
  newProfile: RetrievedProfile,
  oldProfile: RetrievedProfile
});
export type MigrateServicesPreferencesQueueMessage = t.TypeOf<
  typeof MigrateServicesPreferencesQueueMessage
>;

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
function isCosmosError(
  ce: CosmosErrors
): ce is ReturnType<typeof CosmosErrorResponse> {
  return ce.kind === COSMOS_ERROR_KIND;
}

export const createServicePreference = (
  serviceId: ServiceId,
  blockedChannels: ReadonlyArray<BlockedInboxOrChannelEnum>,
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
): NewServicePreference => ({
  fiscalCode,
  id: makeServicesPreferencesDocumentId(fiscalCode, serviceId, version),
  isEmailEnabled: !blockedChannels.includes(BlockedInboxOrChannelEnum.EMAIL),
  isInboxEnabled: !blockedChannels.includes(BlockedInboxOrChannelEnum.INBOX),
  isWebhookEnabled: !blockedChannels.includes(
    BlockedInboxOrChannelEnum.WEBHOOK
  ),
  kind: "INewServicePreference",
  serviceId,
  settingsVersion: version
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const blockedsToServicesPreferences = (
  blocked: {
    // eslint-disable-next-line functional/prefer-readonly-type, @typescript-eslint/array-type
    [x: string]: readonly BlockedInboxOrChannelEnum[];
  },
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
) =>
  pipe(
    O.fromNullable(blocked),
    O.map(b =>
      Object.entries(b)
        // eslint-disable-next-line functional/prefer-readonly-type
        .filter((_): _ is [
          ServiceId,
          ReadonlyArray<BlockedInboxOrChannelEnum>
        ] => ServiceId.is(_[0]))
        .map(([serviceId, blockedInboxOrChannelsForService]) =>
          createServicePreference(
            serviceId,
            blockedInboxOrChannelsForService,
            fiscalCode,
            version
          )
        )
    ),
    O.getOrElse(() => [])
  );

export const MigrateServicePreferenceFromLegacy = (
  servicePreferenceModel: ServicesPreferencesModel,
  tracker: ReturnType<typeof createTracker>
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => async (context: Context, input: unknown) =>
  pipe(
    MigrateServicesPreferencesQueueMessage.decode(input),
    E.mapLeft(errorsToError),
    TE.fromEither,
    // trace event
    TE.map(_ => {
      tracker.profile.traceMigratingServicePreferences(
        _.oldProfile,
        _.newProfile,
        "DOING"
      );
      return _;
    }),
    TE.filterOrElse(
      migrateInput =>
        NonNegativeInteger.is(
          migrateInput.newProfile.servicePreferencesSettings.version
        ),
      () =>
        new Error("Can not migrate to negative services preferences version.")
    ),
    TE.chain(migrateInput => {
      const tasks = blockedsToServicesPreferences(
        migrateInput.oldProfile.blockedInboxOrChannels,
        migrateInput.newProfile.fiscalCode,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        migrateInput.newProfile.servicePreferencesSettings
          .version as NonNegativeInteger // cast required: ts do not identify filterOrElse as a guard
      ).map(preference =>
        pipe(
          servicePreferenceModel.create(preference),
          TE.fold(
            cosmosError =>
              isCosmosError(cosmosError) &&
              cosmosError.error.code === CONFLICT_CODE
                ? TE.of<Error, boolean>(false)
                : TE.left(
                    new Error(
                      `Can not create the service preferences: ${JSON.stringify(
                        cosmosError
                      )}`
                    )
                  ),
            _ => TE.of<Error, boolean>(true)
          )
        )
      );
      return pipe(
        A.array.sequence(TE.ApplicativeSeq)(tasks),
        TE.map(_ => {
          tracker.profile.traceMigratingServicePreferences(
            migrateInput.oldProfile,
            migrateInput.newProfile,
            "DONE"
          );
          return _;
        })
      );
    }),
    TE.getOrElse(error => {
      context.log.error(`${LOG_PREFIX}|ERROR|${error}`);
      throw error;
    })
  )();
