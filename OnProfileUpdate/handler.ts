/* eslint-disable no-underscore-dangle */
import * as t from "io-ts";
import { pipe, flow } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as A from "fp-ts/ReadonlyArray";
import * as E from "fp-ts/lib/Either";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as RTE from "fp-ts/lib/ReaderTaskEither";
import { NonNegativeInteger } from "@pagopa/ts-commons/lib/numbers";
import {
  IProfileEmailReader,
  IProfileEmailWriter,
  ProfileEmail
} from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import {
  ProfileModel,
  Profile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { generateVersionedModelId } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_versioned";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { Logger } from "@azure/functions";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { PathReporter } from "io-ts/PathReporter";
import { FiscalCode } from "../generated/backend/FiscalCode";

const ProfileDocument = t.intersection([
  ProfileEmail,
  t.type({
    _self: NonEmptyString,
    isEmailValidated: t.boolean,
    version: NonNegativeInteger
  })
]);

type ProfileDocument = t.TypeOf<typeof ProfileDocument>;

interface IDependencies {
  readonly dataTableProfileEmailsRepository: IProfileEmailReader &
    IProfileEmailWriter;
  readonly profileModel: ProfileModel;
  readonly logger: { readonly error: Logger["error"] };
}

const getPreviousProfile = (
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
) => ({
  profileModel
}: IDependencies): TE.TaskEither<CosmosErrors, O.Option<Profile>> =>
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
          id => profileModel.find([id, fiscalCode])
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
  pipe(
    TE.tryCatch(
      () => dataTableProfileEmailsRepository.insert(profileEmail),
      error => error
    ),
    TE.orElse(insertError =>
      TE.tryCatch(
        () =>
          // check if the insert operation failed because the record was already there (for example in case of retry of the entire batch)
          dataTableProfileEmailsRepository.get(profileEmail).then(() => {}),
        () =>
          insertError instanceof Error
            ? insertError
            : new Error("error inserting ProfileEmail into table storage")
      )
    )
  );

/*
If the current email is validated but the previous email was not validated => it inserts the new email into profileEmails
If the current email is not validated but the previous email was validated => it deletes the previous email from profileEmails
*/
const handlePositiveVersion = ({
  email,
  fiscalCode,
  isEmailValidated,
  version,
  _self
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
          () =>
            pipe(
              RTE.asks(({ logger }: IDependencies) =>
                logger.error(
                  `no previous profile found for profile with _self ${_self}`
                )
              ),
              RTE.map(() => void 0)
            ),
          previousProfile =>
            isEmailValidated
              ? previousProfile.isEmailValidated
                ? RTE.right(void 0)
                : insertProfileEmail({ email, fiscalCode })
              : previousProfile.isEmailValidated
              ? deleteProfileEmail({
                  email: previousProfile.email,
                  fiscalCode
                })
              : RTE.right(void 0)
        )
      )
    )
  );

const handleProfile = (
  profile: ProfileDocument
): RTE.ReaderTaskEither<IDependencies, Error | CosmosErrors, void> =>
  profile.version === 0
    ? profile.isEmailValidated
      ? insertProfileEmail({
          email: profile.email,
          fiscalCode: profile.fiscalCode
        })
      : RTE.right<IDependencies, Error, void>(void 0)
    : handlePositiveVersion(profile);

export const handler = (documents: ReadonlyArray<unknown>) => (
  dependencies: IDependencies
): T.Task<ReadonlyArray<E.Either<Error | CosmosErrors, void>>> =>
  pipe(
    documents,
    A.map(document =>
      pipe(
        document,
        ProfileDocument.decode,
        E.foldW(
          errors => {
            dependencies.logger.error(
              `error decoding profile with errors ${PathReporter.report(
                E.left(errors)
              )}`
            );
          },
          profileDocument =>
            pipe(
              dependencies,
              handleProfile(profileDocument),
              TE.mapLeft(error => {
                dependencies.logger.error(
                  `error handling profile with _self ${profileDocument._self}`
                );
                return error;
              })
            )
        )
      )
    ),
    A.sequence(T.ApplicativeSeq)
  );
