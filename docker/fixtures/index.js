"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Insert fake data into CosmosDB database emulator.
 */
const documentdb_1 = require("documentdb");
const Either_1 = require("fp-ts/lib/Either");
const service_1 = require("io-functions-commons/dist/src/models/service");
const documentDbUtils = require("io-functions-commons/dist/src/utils/documentdb");
const env_1 = require("io-functions-commons/dist/src/utils/env");
const cosmosDbKey = env_1.getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");
const cosmosDbUri = env_1.getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
const cosmosDbName = env_1.getRequiredStringEnv("COSMOSDB_NAME");
const documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
const servicesCollectionUrl = documentDbUtils.getCollectionUri(documentDbDatabaseUrl, service_1.SERVICE_COLLECTION_NAME);
const documentClient = new documentdb_1.DocumentClient(cosmosDbUri, {
    masterKey: cosmosDbKey
});
function createDatabase(databaseName) {
    return new Promise(resolve => {
        documentClient.createDatabase({ id: databaseName }, (err, _) => {
            if (err) {
                return resolve(Either_1.left(new Error(err.body)));
            }
            resolve(Either_1.right(void 0));
        });
    });
}
function createCollection(collectionName, partitionKey) {
    return new Promise(resolve => {
        const dbUri = documentdb_1.UriFactory.createDatabaseUri(cosmosDbName);
        documentClient.createCollection(dbUri, {
            id: collectionName,
            partitionKey: {
                kind: "Hash",
                paths: [`/${partitionKey}`]
            }
        }, (err, ret) => {
            if (err) {
                return resolve(Either_1.left(new Error(err.body)));
            }
            resolve(Either_1.right(ret));
        });
    });
}
const serviceModel = new service_1.ServiceModel(documentClient, servicesCollectionUrl);
const aService = service_1.Service.decode({
    authorizedCIDRs: [],
    authorizedRecipients: [],
    departmentName: "Deparment Name",
    isVisible: true,
    maxAllowedPaymentAmount: 100000,
    organizationFiscalCode: "01234567890",
    organizationName: "Organization name",
    requireSecureChannels: false,
    serviceId: process.env.REQ_SERVICE_ID,
    serviceName: "MyServiceName"
}).getOrElseL(() => {
    throw new Error("Cannot decode service payload.");
});
createDatabase(cosmosDbName)
    .then(() => createCollection("message-status", "messageId"))
    .then(() => createCollection("messages", "fiscalCode"))
    .then(() => createCollection("notification-status", "notificationId"))
    .then(() => createCollection("notifications", "messageId"))
    .then(() => createCollection("profiles", "fiscalCode"))
    .then(() => createCollection("sender-services", "recipientFiscalCode"))
    .then(() => createCollection("services", "serviceId"))
    .then(() => serviceModel.create(aService, aService.serviceId))
    // tslint:disable-next-line: no-console
    .then(s => console.log(s.value))
    // tslint:disable-next-line: no-console
    .catch(console.error);
