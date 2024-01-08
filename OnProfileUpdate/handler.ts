import * as t from "io-ts";
import { pipe, flow } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as A from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";
import { ProfileEmail } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import {
  ProfileModel,
  Profile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { generateVersionedModelId } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_versioned";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { Logger } from "@azure/functions";
import { FiscalCode } from "../generated/backend/FiscalCode";

const ProfileDocument = t.intersection([
  ProfileEmail,
  t.type({
    isEmailValidated: t.boolean,
    version: NonNegativeInteger
  })
]);

type ProfileDocument = t.TypeOf<typeof ProfileDocument>;

interface IDependencies {
  readonly dataTableProfileEmailsRepository: IProfileEmailWriter;
  readonly profileModel: ProfileModel;
  readonly logger: { readonly error: Logger["error"] };
}

const getPreviousProfile = (
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
) => (dep: IDependencies): TE.TaskEither<CosmosErrors, O.Option<Profile>> =>
  pipe(
    version - 1,
    NonNegativeInteger.decode,
    E.fold(
      () => TE.right(O.none),
      previousVersion =>
        pipe(
          generateVersionedModelId<Profile, "fiscalCode">(
            fiscalCode,
            previousVersion
          ),
          id => dep.profileModel.find([id, fiscalCode])
        )
    )
  );

const deleteProfileEmail = (profileEmail: ProfileEmail) => ({
  dataTableProfileEmailsRepository
}: IDependencies): TE.TaskEither<Error, void> =>
  TE.tryCatch(
    () => dataTableProfileEmailsRepository.delete(profileEmail),
    error =>
      error instanceof Error
        ? error
        : new Error("error deleting ProfileEmail from table storage")
  );

const insertProfileEmail = (profileEmail: ProfileEmail) => ({
  dataTableProfileEmailsRepository
}: IDependencies): TE.TaskEither<Error, void> =>
  TE.tryCatch(
    () => dataTableProfileEmailsRepository.insert(profileEmail),
    error =>
      error instanceof Error
        ? error
        : new Error("error inserting ProfileEmail from table storage")
  );

/*
If the current email is validated but the previous email was not validated => it inserts the new email into profileEmails
If the current email is not validated but the previous email was validated => it deletes the previous email from profileEmails
*/
const handlePositiveVersion = ({
  email,
  fiscalCode,
  isEmailValidated,
  version
}: ProfileDocument): RTE.ReaderTaskEither<
  IDependencies,
  Error | CosmosErrors,
  void
> =>
  pipe(
    getPreviousProfile(fiscalCode, version),
    RTE.chainW(
      flow(
        O.foldW(
          () => RTE.right<IDependencies, Error, void>(void 0),
          previousProfile =>
            isEmailValidated
              ? previousProfile.isEmailValidated
                ? RTE.right<IDependencies, Error, void>(void 0)
                : insertProfileEmail({ email, fiscalCode })
              : previousProfile.isEmailValidated
              ? deleteProfileEmail({
                  email: previousProfile.email,
                  fiscalCode
                })
              : RTE.right<IDependencies, Error, void>(void 0)
        )
      )
    )
  );

const handleProfile = ({
  fiscalCode,
  email,
  version,
  isEmailValidated
}: ProfileDocument): RTE.ReaderTaskEither<
  IDependencies,
  Error | CosmosErrors,
  void
> =>
  version === 0
    ? isEmailValidated
      ? insertProfileEmail({ email, fiscalCode })
      : RTE.right<IDependencies, Error, void>(void 0)
    : handlePositiveVersion({
        email,
        fiscalCode,
        isEmailValidated,
        version
      });

export const handler = (documents: ReadonlyArray<unknown>) => async (
  dependencies: IDependencies
): Promise<void> => {
  await pipe(
    documents.map(document =>
      pipe(
        document,
        ProfileDocument.decode,
        E.fold(
          () => TE.right<Error, void>(void 0),
          profileDocument =>
            pipe(
              dependencies,
              handleProfile(profileDocument),
              TE.mapLeft(error => {
                dependencies.logger.error(
                  `error handling profile with fiscalCode ${profileDocument.fiscalCode} and version ${profileDocument.version}`,
                  error
                );
                return error;
              })
            )
        )
      )
    ),
    A.sequence(TE.ApplicativeSeq)
  )();
};
