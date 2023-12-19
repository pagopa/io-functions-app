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
import { FiscalCode } from "../generated/backend/FiscalCode";
import {
  ProfileModel,
  Profile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { generateVersionedModelId } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_versioned";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { Logger } from "@azure/functions";

const ProfileDocument = t.intersection([
  ProfileEmail,
  t.type({
    isEmailValidated: t.literal(true),
    version: NonNegativeInteger
  })
]);

type ProfileDocument = t.TypeOf<typeof ProfileDocument>;

type Dependencies = {
  dataTableProfileEmailsRepository: DataTableProfileEmailsRepository;
  profileModel: ProfileModel;
  logger: { error: Logger["error"] };
};

// this function gets the last validated email for that fiscal code from `profile` collection
const getPreviousValidatedEmail = (
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
) => (
  profileModel: ProfileModel
): TE.TaskEither<CosmosErrors, O.Option<Profile["email"]>> =>
  pipe(
    generateVersionedModelId<Profile, "fiscalCode">(fiscalCode, version),
    id => profileModel.find([id, fiscalCode]),
    TE.chain(
      O.fold(
        () => TE.of(O.none),
        previousProfile =>
          previousProfile.isEmailValidated
            ? TE.of(O.some(previousProfile.email))
            : pipe(
                NonNegativeInteger.decode(version - 1),
                E.fold(
                  () => TE.of(O.none),
                  newVersion =>
                    pipe(
                      profileModel,
                      getPreviousValidatedEmail(fiscalCode, newVersion)
                    )
                )
              )
      )
    )
  );

const deleteProfileEmail = (
  profileEmail: ProfileEmail
): RTE.ReaderTaskEither<
  DataTableProfileEmailsRepository,
  Error,
  void
> => dataTableProfileEmailsRepository =>
  TE.tryCatch(
    () => dataTableProfileEmailsRepository.delete(profileEmail),
    error =>
      error instanceof Error
        ? error
        : new Error("error deleting ProfileEmail from table storage")
  );

const insertProfileEmail = (
  profileEmail: ProfileEmail
): RTE.ReaderTaskEither<
  DataTableProfileEmailsRepository,
  Error,
  void
> => dataTableProfileEmailsRepository =>
  TE.tryCatch(
    () => dataTableProfileEmailsRepository.insert(profileEmail),
    error =>
      error instanceof Error
        ? error
        : new Error("error inserting ProfileEmail from table storage")
  );

const upsertProfileEmail = ({
  email,
  fiscalCode,
  version
}: Omit<ProfileDocument, "isEmailValidated">) => ({
  dataTableProfileEmailsRepository,
  profileModel
}: Omit<Dependencies, "logger">) =>
  pipe(
    version - 1,
    NonNegativeInteger.decode,
    E.fold(
      () => TE.right<Error, void>(void 0),
      previousVersion =>
        pipe(
          profileModel,
          getPreviousValidatedEmail(fiscalCode, previousVersion),
          TE.chainW(
            flow(
              O.foldW(
                () =>
                  pipe(
                    dataTableProfileEmailsRepository,
                    insertProfileEmail({ email, fiscalCode })
                  ),
                previousEmail =>
                  pipe(
                    email === previousEmail
                      ? TE.right<Error, void>(void 0)
                      : pipe(
                          pipe(
                            dataTableProfileEmailsRepository,
                            deleteProfileEmail({
                              email: previousEmail,
                              fiscalCode
                            })
                          ),
                          TE.chain(() =>
                            pipe(
                              dataTableProfileEmailsRepository,
                              insertProfileEmail({ email, fiscalCode })
                            )
                          )
                        )
                  )
              )
            )
          )
        )
    )
  );

const handleDocument = (
  document: unknown
): RTE.ReaderTaskEither<Dependencies, Error, void> => ({
  dataTableProfileEmailsRepository,
  profileModel,
  logger
}) =>
  pipe(
    document,
    ProfileDocument.decode,
    E.fold(
      () => TE.right(void 0),
      ({ email, fiscalCode, version }) =>
        version === 0
          ? pipe(
              dataTableProfileEmailsRepository,
              insertProfileEmail({ email, fiscalCode }),
              TE.mapLeft(error => {
                logger.error(
                  `error inserting profile with fiscalCode ${fiscalCode} and version ${version}`,
                  error
                );
                return error;
              })
            )
          : pipe(
              {
                dataTableProfileEmailsRepository,
                profileModel
              },
              upsertProfileEmail({ email, fiscalCode, version }),
              TE.mapLeft(error => {
                logger.error(
                  `error upserting profile with fiscalCode ${fiscalCode} and version ${version}`,
                  error
                );
                return error instanceof Error ? error : new Error(error.kind);
              })
            )
    )
  );

export const handler = (documents: ReadonlyArray<unknown>) => async (
  dependencies: Dependencies
): Promise<void> => {
  await pipe(
    documents.map(document => pipe(dependencies, handleDocument(document))),
    A.sequence(TE.ApplicativeSeq)
  )();
};
