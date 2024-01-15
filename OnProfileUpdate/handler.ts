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
  ProfileEmail,
  ProfileEmailWriterError
} from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement";
import {
  ProfileModel,
  Profile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { generateVersionedModelId } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model_versioned";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { EmailString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { hashFiscalCode } from "@pagopa/ts-commons/lib/hash";
import { TelemetryClient } from "applicationinsights";
import { withDefault } from "@pagopa/ts-commons/lib/types";
import { FiscalCode } from "../generated/backend/FiscalCode";

export const ProfileDocument = t.intersection([
  t.type({
    _self: NonEmptyString,
    fiscalCode: FiscalCode,
    isEmailValidated: withDefault(t.boolean, true),
    version: NonNegativeInteger
  }),
  t.partial({
    email: EmailString
  })
]);

type ProfileDocument = t.TypeOf<typeof ProfileDocument>;

interface IDependencies {
  readonly dataTableProfileEmailsRepository: IProfileEmailReader &
    IProfileEmailWriter;
  readonly profileModel: ProfileModel;
  readonly telemetryClient: TelemetryClient;
}

const eventNamePrefix = "OnProfileUpdate";

const getPreviousProfile = (
  fiscalCode: FiscalCode,
  version: NonNegativeInteger
) => ({
  profileModel
}: IDependencies): TE.TaskEither<
  CosmosErrors | t.Errors,
  O.Option<ProfileDocument>
> =>
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
          id =>
            pipe(
              profileModel.find([id, fiscalCode]),
              TE.chainW(
                O.fold(
                  () => TE.right(O.none),
                  profile =>
                    pipe(
                      ProfileDocument.decode(profile),
                      E.fold(
                        error => TE.left(error),
                        profileDocument => TE.right(O.some(profileDocument))
                      )
                    )
                )
              )
            )
        )
    )
  );

const deleteProfileEmail = (profileEmail: ProfileEmail) => ({
  dataTableProfileEmailsRepository
}: IDependencies): TE.TaskEither<Error, void> =>
  pipe(
    TE.tryCatch(
      () => dataTableProfileEmailsRepository.delete(profileEmail),
      error =>
        error instanceof Error
          ? error
          : new Error("error deleting ProfileEmail from table storage")
    ),
    TE.orElse(error =>
      ProfileEmailWriterError.is(error) && error.cause === "ENTITY_NOT_FOUND"
        ? TE.right(void 0)
        : TE.left(error)
    )
  );

const insertProfileEmail = (profileEmail: ProfileEmail) => ({
  dataTableProfileEmailsRepository
}: IDependencies): TE.TaskEither<Error, void> =>
  pipe(
    TE.tryCatch(
      () => dataTableProfileEmailsRepository.insert(profileEmail),
      error =>
        error instanceof Error
          ? error
          : new Error("error inserting ProfileEmail into table storage")
    ),
    TE.orElse(error =>
      ProfileEmailWriterError.is(error) && error.cause === "DUPLICATE_ENTITY"
        ? TE.right(void 0)
        : TE.left(error)
    )
  );

const updateEmail: (
  profile: Required<
    Pick<ProfileDocument, "isEmailValidated" | "email" | "fiscalCode">
  >,
  previousProfile: Required<
    Pick<ProfileDocument, "isEmailValidated" | "email" | "fiscalCode">
  >
) => RTE.ReaderTaskEither<IDependencies, Error, void> = (
  profile,
  previousProfile
) =>
  profile.isEmailValidated
    ? previousProfile.isEmailValidated
      ? RTE.right(void 0)
      : insertProfileEmail({
          email: profile.email,
          fiscalCode: profile.fiscalCode
        })
    : previousProfile.isEmailValidated
    ? deleteProfileEmail({
        email: previousProfile.email,
        fiscalCode: profile.fiscalCode
      })
    : RTE.right(void 0);

const handlePresentEmail = (
  previousProfile: ProfileDocument,
  profile: Required<ProfileDocument>
): RTE.ReaderTaskEither<IDependencies, Error, void> =>
  pipe(
    O.fromNullable(previousProfile.email),
    O.fold(
      () =>
        profile.isEmailValidated
          ? insertProfileEmail({
              email: profile.email,
              fiscalCode: profile.fiscalCode
            })
          : RTE.right(void 0),
      previousEmail =>
        updateEmail(
          {
            email: profile.email,
            fiscalCode: profile.fiscalCode,
            isEmailValidated: profile.isEmailValidated
          },
          {
            email: previousEmail,
            fiscalCode: previousProfile.fiscalCode,
            isEmailValidated: previousProfile.isEmailValidated
          }
        )
    )
  );

const handleMissingEmail = (
  previousProfile: ProfileDocument,
  profile: Omit<ProfileDocument, "email">
) => (dependencies: IDependencies): TE.TaskEither<Error, void> =>
  pipe(
    O.fromNullable(previousProfile.email),
    O.fold(
      () => TE.right(void 0),
      previousEmail => {
        dependencies.telemetryClient.trackEvent({
          name: `${eventNamePrefix}.missingNewEmail`,
          properties: {
            _self: profile._self,
            fiscalCode: hashFiscalCode(profile.fiscalCode),
            isEmailValidated: profile.isEmailValidated,
            isPreviousEmailValidated: previousProfile.isEmailValidated
          },
          tagOverrides: { samplingEnabled: "false" }
        });
        return previousProfile.isEmailValidated
          ? pipe(
              dependencies,
              deleteProfileEmail({
                email: previousEmail,
                fiscalCode: profile.fiscalCode
              })
            )
          : TE.right(void 0);
      }
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
  Error | CosmosErrors | t.Errors,
  void
> =>
  pipe(
    getPreviousProfile(fiscalCode, version),
    RTE.chainW(
      flow(
        O.foldW(
          () =>
            pipe(
              RTE.asks(({ telemetryClient }: IDependencies) =>
                telemetryClient.trackEvent({
                  name: `${eventNamePrefix}.previousProfileNotFound`,
                  properties: {
                    _self,
                    fiscalCode: hashFiscalCode(fiscalCode)
                  },
                  tagOverrides: { samplingEnabled: "false" }
                })
              ),
              RTE.map(() => void 0)
            ),
          previousProfile =>
            email
              ? handlePresentEmail(previousProfile, {
                  _self,
                  email,
                  fiscalCode,
                  isEmailValidated,
                  version
                })
              : handleMissingEmail(previousProfile, {
                  _self,
                  fiscalCode,
                  isEmailValidated,
                  version
                })
        )
      )
    )
  );

const handleProfile = (
  profile: ProfileDocument
): RTE.ReaderTaskEither<IDependencies, Error | CosmosErrors | t.Errors, void> =>
  profile.version === 0
    ? profile.email && profile.isEmailValidated
      ? insertProfileEmail({
          email: profile.email,
          fiscalCode: profile.fiscalCode
        })
      : RTE.right<IDependencies, Error, void>(void 0)
    : handlePositiveVersion(profile);

export const handler = (documents: ReadonlyArray<unknown>) => (
  dependencies: IDependencies
): T.Task<ReadonlyArray<E.Either<Error | CosmosErrors | t.Errors, void>>> =>
  pipe(
    documents,
    A.map(document =>
      pipe(
        document,
        ProfileDocument.decode,
        E.foldW(
          () => {
            dependencies.telemetryClient.trackEvent({
              name: `${eventNamePrefix}.decodingProfile`,
              properties: {
                _self:
                  typeof document === "object" &&
                  document !== null &&
                  "_self" in document
                    ? document._self
                    : "unknown-id"
              },
              tagOverrides: { samplingEnabled: "false" }
            });
            return TE.right<never, void>(void 0);
          },
          profileDocument =>
            pipe(
              dependencies,
              handleProfile(profileDocument),
              TE.mapLeft(error => {
                dependencies.telemetryClient.trackEvent({
                  name: `${eventNamePrefix}.handlingProfile`,
                  properties: {
                    _self: profileDocument._self,
                    error,
                    fiscalCode: hashFiscalCode(profileDocument.fiscalCode)
                  },
                  tagOverrides: { samplingEnabled: "false" }
                });
                return error;
              })
            )
        )
      )
    ),
    A.sequence(T.ApplicativeSeq)
  );
