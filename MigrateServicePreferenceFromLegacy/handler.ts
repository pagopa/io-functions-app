import { Context } from "@azure/functions";
import {
  makeServicesPreferencesDocumentId,
  ServicePreference
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import {
  NewServicePreference,
  ServicesPreferencesModel
} from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import * as te from "fp-ts/lib/TaskEither";
import * as t from "io-ts";

const CONFLICT_CODE = 409;
const LOG_PREFIX = "MigrateServicePreferenceFromLegacy";

export const MigrateServicesPreferencesQueueMessage = t.interface({
  preference: ServicePreference
});
export type MigrateServicesPreferencesQueueMessage = t.TypeOf<
  typeof MigrateServicesPreferencesQueueMessage
>;

type MigrateServicePreferenceFromLegacyErrors =
  | CosmosErrors
  | { kind: "INVALID_INPUT" };

export const MigrateServicePreferenceFromLegacy = (
  servicePreferenceModel: ServicesPreferencesModel
) => async (context: Context, input: unknown) =>
  // decode input
  te.taskEither
    .of<MigrateServicePreferenceFromLegacyErrors, unknown>(input)
    .chain(i =>
      te.fromEither(
        MigrateServicesPreferencesQueueMessage.decode(i).mapLeft(x => ({
          kind: "INVALID_INPUT"
        }))
      )
    )
    .map(({ preference }) =>
      NewServicePreference.encode({
        ...preference,
        id: makeServicesPreferencesDocumentId(
          preference.fiscalCode,
          preference.serviceId,
          preference.settingsVersion
        ),
        kind: "INewServicePreference"
      })
    )
    // save preference
    .chain((preference: NewServicePreference) =>
      servicePreferenceModel.create(preference)
    )
    // if save fails because of primary key conflicts, it means the use saved the same preference meanwhile
    // such case is not to be considered a failure, it's ok to discard the operation
    .foldTaskEither(
      _ =>
        _.kind === "COSMOS_ERROR_RESPONSE" && _.error.code === CONFLICT_CODE
          ? te.taskEither.of("ok" as const)
          : te.fromLeft(_),
      _ => te.taskEither.of("ok" as const)
    )
    .getOrElseL(error => {
      context.log.error(`${LOG_PREFIX}|ERROR|${error}`);
      throw error;
    })
    .run();
