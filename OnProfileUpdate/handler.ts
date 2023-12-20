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
    isEmailValidated: t.literal(true),
    version: NonNegativeInteger
  })
]);

type ProfileDocument = t.TypeOf<typeof ProfileDocument>;

interface IDependencies {
  readonly dataTableProfileEmailsRepository: DataTableProfileEmailsRepository;
  readonly profileModel: ProfileModel;
  readonly logger: { readonly error: Logger["error"] };
}

// this function gets the latest validated email for that fiscal code from `profile` collection
const getLatestValidatedEmail = (
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
) => (
  dep: IDependencies
): TE.TaskEither<CosmosErrors, O.Option<Profile["email"]>> =>
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
          id => dep.profileModel.find([id, fiscalCode]),
          TE.chain(
            O.fold(
              () => TE.of(O.none),
              previousProfile =>
                previousProfile.isEmailValidated
                  ? TE.right(O.some(previousProfile.email))
                  : pipe(
                      dep,
                      getLatestValidatedEmail(fiscalCode, previousVersion)
                    )
            )
          )
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
This function gets the latest validated email for the user
If that email doesn't exist => it inserts the new email into profileEmails
If that email exists and matches the new email => it does not do anything
If that email exists and doesn't match the new email => it deletes the old email from profileEmails and inserts the new email
*/
const upsertProfileEmail = ({
  email,
  fiscalCode,
  version
}: Omit<ProfileDocument, "isEmailValidated">): RTE.ReaderTaskEither<
  IDependencies,
  Error | CosmosErrors,
  void
> =>
  pipe(
    getLatestValidatedEmail(fiscalCode, version),
    RTE.chainW(
      flow(
        O.foldW(
          () => insertProfileEmail({ email, fiscalCode }),
          previousEmail =>
            pipe(
              email === previousEmail
                ? RTE.right<IDependencies, Error, void>(void 0)
                : pipe(
                    deleteProfileEmail({
                      email: previousEmail,
                      fiscalCode
                    }),
                    RTE.chain(() => insertProfileEmail({ email, fiscalCode }))
                  )
            )
        )
      )
    )
  );

const handleDocument = (
  document: unknown
): RTE.ReaderTaskEither<IDependencies, Error | CosmosErrors, void> =>
  pipe(
    document,
    ProfileDocument.decode,
    E.fold(
      () => RTE.right<IDependencies, Error, void>(void 0),
      ({ email, fiscalCode, version }) =>
        version === 0
          ? insertProfileEmail({ email, fiscalCode })
          : upsertProfileEmail({ email, fiscalCode, version })
    )
  );

export const handler = (documents: ReadonlyArray<unknown>) => async (
  dependencies: IDependencies
): Promise<void> => {
  await pipe(
    documents.map(document =>
      pipe(
        dependencies,
        handleDocument(document),
        TE.mapLeft(error => {
          pipe(
            // TODO
            O.fromPredicate(
              (
                doc: unknown
              ): doc is {
                readonly fiscalCode: string;
                readonly version: string;
              } =>
                typeof doc === "object" &&
                "fiscalCode" in doc &&
                "version" in doc
            )(document),
            O.fold(
              () => dependencies.logger.error(error),
              ({ fiscalCode, version }) =>
                dependencies.logger.error(
                  `error handling profile with fiscalCode ${fiscalCode} and version ${version}`,
                  error
                )
            )
          );
          return error;
        })
      )
    ),
    A.sequence(TE.ApplicativeSeq)
  )();
};
