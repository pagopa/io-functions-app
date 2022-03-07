import { CosmosClient, Database } from "@azure/cosmos";

import * as TE from "fp-ts/lib/TaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import { pipe } from "fp-ts/lib/function";

import * as MessageCollection from "@pagopa/io-functions-commons/dist/src/models/message";
import * as MessageStatusCollection from "@pagopa/io-functions-commons/dist/src/models/message_status";
import * as ServiceModel from "@pagopa/io-functions-commons/dist/src/models/service";

import { log } from "../utils/logger";
import {
  createContainer as createCollection,
  createDatabase,
  deleteContainer
} from "./utils/cosmos";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { CosmosErrors } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { debugPort } from "process";
import { toCosmosErrorResponse } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";
import { Container } from "@azure/cosmos";
import { BlobService } from "azure-storage";
import { MESSAGE_CONTAINER_NAME } from "../env";

/**
 * Create "messages" collection, with indexing policy
 *
 * @param db
 * @returns
 */
const createMessageCollection = (
  db: Database
): TE.TaskEither<CosmosErrors, Container> =>
  pipe(
    createCollection(
      db,
      MessageCollection.MESSAGE_COLLECTION_NAME,
      MessageCollection.MESSAGE_MODEL_PK_FIELD,
      {
        indexingMode: "consistent",
        automatic: true,
        includedPaths: [
          {
            path: "/*"
          }
        ],
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ],
        compositeIndexes: [
          [
            {
              path: "/fiscalCode",
              order: "ascending"
            },
            {
              path: "/id",
              order: "descending"
            }
          ]
        ]
      } as any
    )
  );
/**
 *
 * @param database
 * @returns
 */
export const createAllCollections = (
  database: Database
): TE.TaskEither<CosmosErrors, readonly Container[]> =>
  pipe(
    [
      // messages
      createMessageCollection(database),
      // services
      createCollection(
        database,
        ServiceModel.SERVICE_COLLECTION_NAME,
        ServiceModel.SERVICE_MODEL_PK_FIELD
      ),
      // message-status
      createCollection(
        database,
        MessageStatusCollection.MESSAGE_STATUS_COLLECTION_NAME,
        MessageStatusCollection.MESSAGE_STATUS_MODEL_PK_FIELD
      )
    ],
    RA.sequence(TE.ApplicativePar)
  );

/**
 * Create DB
 */
export const deleteAllCollections = (
  database: Database
): TE.TaskEither<CosmosErrors, readonly Container[]> => {
  log("deleting CosmosDB");

  return pipe(
    database,
    TE.of,
    TE.bindTo("db"),
    TE.bind("collectionNames", ({ db }) =>
      pipe(
        TE.tryCatch(
          () => db.containers.readAll().fetchAll(),
          toCosmosErrorResponse
        ),
        TE.map(r => r.resources),
        TE.map(RA.map(r => r.id))
      )
    ),
    TE.chain(({ db, collectionNames }) =>
      pipe(
        collectionNames,
        RA.map(r => deleteContainer(db, r)),
        RA.sequence(TE.ApplicativePar)
      )
    ),
    TE.map(collections => {
      log("Deleted", collections.length, "collections");
      return collections;
    }),
    TE.mapLeft(err => {
      log("Error", err);
      return err;
    })
  );
};

/**
 * Create DB and collections
 */
export const createCosmosDbAndCollections = (
  client: CosmosClient,
  cosmosDbName: string
): TE.TaskEither<CosmosErrors, Database> =>
  pipe(
    createDatabase(client, cosmosDbName),
    // Delete all collections, in case they already exist
    TE.chainFirst(deleteAllCollections),
    TE.chainFirst(createAllCollections),
    TE.mapLeft(err => {
      log("Error", err);
      return err;
    })
  );

// ------------------
// Fil data
// ------------------

/**
 * Create DB
 */
export const fillMessages = async (
  db: Database,
  blobService: BlobService,
  messages: ReadonlyArray<MessageCollection.NewMessageWithContent>
): Promise<void> => {
  await pipe(
    db.container(MessageCollection.MESSAGE_COLLECTION_NAME),
    TE.of,
    TE.map(
      c =>
        new MessageCollection.MessageModel(
          c,
          MESSAGE_CONTAINER_NAME as NonEmptyString
        )
    ),
    TE.chainFirst(model =>
      pipe(
        messages,
        RA.map(m => model.create(m)),
        RA.sequence(TE.ApplicativePar)
      )
    ),
    TE.chainW(model =>
      pipe(
        messages,
        RA.filter(m => m.isPending === false),
        RA.map(m => model.storeContentAsBlob(blobService, m.id, m.content)),
        RA.sequence(TE.ApplicativePar)
      )
    ),
    TE.map(_ => log(`${_.length} Messages created`)),
    TE.mapLeft(_ => {
      log("Error", _);
    })
  )();
};

export const fillServices = async (
  db: Database,
  services: ReadonlyArray<ServiceModel.NewService>
): Promise<void> => {
  await pipe(
    db.container(ServiceModel.SERVICE_COLLECTION_NAME),
    TE.of,
    TE.map(c => new ServiceModel.ServiceModel(c)),
    TE.chain(model =>
      pipe(
        services,
        RA.map(m => model.create(m)),
        RA.sequence(TE.ApplicativePar)
      )
    ),
    TE.map(_ => log(`${_.length} Services created`)),
    TE.mapLeft(_ => {
      log("Error", _);
    })
  )();
};

export const fillMessagesStatus = async (
  db: Database,
  messageStatuses: ReadonlyArray<MessageStatusCollection.NewMessageStatus>
) =>
  pipe(
    db.container(MessageStatusCollection.MESSAGE_STATUS_COLLECTION_NAME),
    TE.of,
    TE.map(c => new MessageStatusCollection.MessageStatusModel(c)),
    TE.chain(messageStatusModel =>
      pipe(
        messageStatuses,
        RA.mapWithIndex((i, m) =>
          i === 0 ? messageStatusModel.create(m) : messageStatusModel.upsert(m)
        ),
        RA.sequence(TE.ApplicativeSeq)
      )
    )
  )();
