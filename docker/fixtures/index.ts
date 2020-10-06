/**
 * Insert fake data into CosmosDB database emulator.
 */
import { ContainerResponse, CosmosClient, Database } from "@azure/cosmos";
import { toError } from "fp-ts/lib/Either";
import {
  NewProfile,
  Profile,
  PROFILE_COLLECTION_NAME,
  ProfileModel
} from "io-functions-commons/dist/src/models/profile";
import {
  NewService,
  Service,
  SERVICE_COLLECTION_NAME,
  ServiceModel
} from "io-functions-commons/dist/src/models/service";

import { sequenceT } from "fp-ts/lib/Apply";
import { TaskEither, taskEitherSeq, tryCatch } from "fp-ts/lib/TaskEither";

import { getConfigOrThrow } from "../../utils/config";

const config = getConfigOrThrow();

const cosmosDbKey = config.CUSTOMCONNSTR_COSMOSDB_KEY;
const cosmosDbUri = config.CUSTOMCONNSTR_COSMOSDB_URI;
const cosmosDbName = config.COSMOSDB_NAME;

export const cosmosdbClient = new CosmosClient({
  endpoint: cosmosDbUri,
  key: cosmosDbKey
});

function createDatabase(databaseName: string): TaskEither<Error, Database> {
  return tryCatch(
    () => cosmosdbClient.databases.create({ id: databaseName }),
    toError
  ).map(_ => _.database);
}

function createCollection(
  db: Database,
  collectionName: string,
  partitionKey: string
): TaskEither<Error, ContainerResponse> {
  return tryCatch(
    () => db.containers.createIfNotExists({ id: collectionName, partitionKey }),
    toError
  );
}

const aService: Service = Service.decode({
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
}).getOrElseL(() => {
  throw new Error("Cannot decode service payload.");
});

const aNewService = NewService.decode({
  ...aService,
  kind: "INewService"
}).getOrElseL(() => {
  throw new Error("Cannot decode new service.");
});

const aProfile: Profile = Profile.decode({
  acceptedTosVersion: 1,
  email: "email@example.com",
  fiscalCode: "AAAAAA00A00A000A",
  isEmailEnabled: true,
  isEmailValidated: true,
  isInboxEnabled: true,
  isWebhookEnabled: true
}).getOrElseL(() => {
  throw new Error("Cannot decode profile payload.");
});

const aNewProfile = NewProfile.decode({
  ...aProfile,
  kind: "INewProfile"
}).getOrElseL(() => {
  throw new Error("Cannot decode new profile.");
});

createDatabase(cosmosDbName)
  .chain(db =>
    sequenceT(taskEitherSeq)(
      createCollection(db, "message-status", "messageId"),
      createCollection(db, "messages", "fiscalCode"),
      createCollection(db, "notification-status", "notificationId"),
      createCollection(db, "notifications", "messageId"),
      createCollection(db, "profiles", "fiscalCode"),
      createCollection(db, "services", "serviceId")
    ).map(_ => db)
  )
  .chain(db =>
    sequenceT(taskEitherSeq)(
      new ServiceModel(db.container(SERVICE_COLLECTION_NAME)).create(
        aNewService
      ),
      new ProfileModel(db.container(PROFILE_COLLECTION_NAME)).create(
        aNewProfile
      )
    ).mapLeft(_ => new Error(`CosmosError: ${_.kind}`))
  )
  .run()
  .then(
    // tslint:disable-next-line: no-console
    _ => console.log(`Successfully created fixtures`),
    // tslint:disable-next-line: no-console
    _ => console.error(`Failed generate fixtures ${_.message}`)
  );
