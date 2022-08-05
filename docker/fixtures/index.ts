/**
 * Insert fake data into CosmosDB database emulator.
 */
import { ContainerResponse, CosmosClient, Database } from "@azure/cosmos";
import {
  NewProfile,
  Profile,
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import {
  NewService,
  Service,
  SERVICE_COLLECTION_NAME,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { sequenceT } from "fp-ts/lib/Apply";
import { toError } from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/function";
import { getConfigOrThrow } from "../../utils/config";

const config = getConfigOrThrow();

export const cosmosDbUri = config.COSMOSDB_URI;
export const cosmosDbKey = config.COSMOSDB_KEY;

export const cosmosdbClient = new CosmosClient({
  endpoint: cosmosDbUri,
  key: cosmosDbKey
});

const createDatabase = (databaseName: string): TE.TaskEither<Error, Database> =>
  pipe(
    TE.tryCatch(
      () => cosmosdbClient.databases.create({ id: databaseName }),
      toError
    ),
    TE.map(response => response.database)
  )

const createCollection = (
  db: Database,
  collectionName: string,
  partitionKey: string
): TE.TaskEither<Error, ContainerResponse> =>
  TE.tryCatch(
    () => db.containers.createIfNotExists({ id: collectionName, partitionKey }),
    toError
  );

const aService: Service = pipe(
  Service.decode({
    authorizedCIDRs: [],
    authorizedRecipients: [],
    departmentName: "Deparment Name",
    isVisible: true,
    maxAllowedPaymentAmount: 100000,
    organizationFiscalCode: "01234567890",
    organizationName: "Organization name",
    requireSecureChannels: false,
    serviceId: config.REQ_SERVICE_ID,
    serviceName: "MyServiceName"
  }),
  E.getOrElse(() => {
    throw new Error("Cannot decode service payload.");
  })
)

const aNewService = pipe(
  NewService.decode({
    ...aService,
    kind: "INewService"
  }),
  E.getOrElse(() => {
    throw new Error("Cannot decode new service.");
  }))

const aProfile: Profile = pipe(
  Profile.decode({
    acceptedTosVersion: 1,
    email: "email@example.com",
    fiscalCode: "AAAAAA00A00A000A",
    isEmailEnabled: true,
    isEmailValidated: true,
    isInboxEnabled: true,
    isWebhookEnabled: true
  }),
  E.getOrElse(() => {
    throw new Error("Cannot decode profile payload.");
  }))

const aNewProfile = pipe(
  NewProfile.decode({
    ...aProfile,
    kind: "INewProfile"
  }), E.getOrElse(() => {
    throw new Error("Cannot decode new profile.");
  })
)

pipe(
  createDatabase(config.COSMOSDB_NAME),
  TE.chain(db =>
    pipe(
      sequenceT(TE.ApplySeq)(
        createCollection(db, "message-status", "messageId"),
        createCollection(db, "messages", "fiscalCode"),
        createCollection(db, "notification-status", "notificationId"),
        createCollection(db, "notifications", "messageId"),
        createCollection(db, "profiles", "fiscalCode"),
        createCollection(db, "services", "serviceId")
      ),
      TE.map(_ => db)
    )
  ),
  TE.chain(db =>
    pipe(
      sequenceT(TE.ApplySeq)(
        new ServiceModel(db.container(SERVICE_COLLECTION_NAME)).create(
          aNewService
        ),
        new ProfileModel(db.container(PROFILE_COLLECTION_NAME)).create(
          aNewProfile
        )
      ),
      TE.mapLeft(_ => new Error(`CosmosError: ${_.kind}`))
    )
  )
)().then(
  // eslint-disable-next-line no-console
  _ => console.log(`Successfully created fixtures`),
  // eslint-disable-next-line no-console
  _ => console.error(`Failed generate fixtures ${_.message}`)
)
