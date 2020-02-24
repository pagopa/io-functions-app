"use strict";
exports.__esModule = true;
/**
 * Insert fake data into CosmosDB database emulator.
 */
var documentdb_1 = require("documentdb");
var Either_1 = require("fp-ts/lib/Either");
var UserDataProcessingChoice_1 = require("io-functions-commons/dist/generated/definitions/UserDataProcessingChoice");
var UserDataProcessingStatus_1 = require("io-functions-commons/dist/generated/definitions/UserDataProcessingStatus");
var service_1 = require("io-functions-commons/dist/src/models/service");
var user_data_processing_1 = require("io-functions-commons/dist/src/models/user_data_processing");
var documentDbUtils = require("io-functions-commons/dist/src/utils/documentdb");
var env_1 = require("io-functions-commons/dist/src/utils/env");
var strings_1 = require("io-functions-commons/dist/src/utils/strings");
var cosmosDbKey = env_1.getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_KEY");
var cosmosDbUri = env_1.getRequiredStringEnv("CUSTOMCONNSTR_COSMOSDB_URI");
var cosmosDbName = env_1.getRequiredStringEnv("COSMOSDB_NAME");
var documentDbDatabaseUrl = documentDbUtils.getDatabaseUri(cosmosDbName);
var servicesCollectionUrl = documentDbUtils.getCollectionUri(documentDbDatabaseUrl, service_1.SERVICE_COLLECTION_NAME);
var userDataProcessingCollectionUrl = documentDbUtils.getCollectionUri(documentDbDatabaseUrl, user_data_processing_1.USER_DATA_PROCESSING_COLLECTION_NAME);
var documentClient = new documentdb_1.DocumentClient(cosmosDbUri, {
    masterKey: cosmosDbKey
});
function createDatabase(databaseName) {
    return new Promise(function (resolve) {
        documentClient.createDatabase({ id: databaseName }, function (err, _) {
            if (err) {
                return resolve(Either_1.left(new Error(err.body)));
            }
            resolve(Either_1.right(void 0));
        });
    });
}
function createCollection(collectionName, partitionKey) {
    return new Promise(function (resolve) {
        var dbUri = documentdb_1.UriFactory.createDatabaseUri(cosmosDbName);
        documentClient.createCollection(dbUri, {
            id: collectionName,
            partitionKey: {
                kind: "Hash",
                paths: ["/" + partitionKey]
            }
        }, function (err, ret) {
            if (err) {
                return resolve(Either_1.left(new Error(err.body)));
            }
            resolve(Either_1.right(ret));
        });
    });
}
var serviceModel = new service_1.ServiceModel(documentClient, servicesCollectionUrl);
var aService = service_1.Service.decode({
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
}).getOrElseL(function () {
    throw new Error("Cannot decode service payload.");
});
exports.aFiscalCode = "SPNDNL80A13Y555X";
var userDataProcessingModel = new user_data_processing_1.UserDataProcessingModel(documentClient, userDataProcessingCollectionUrl);
var aUserDataProcessing = user_data_processing_1.UserDataProcessing.decode({
    id: strings_1.ulidGenerator(),
    // tslint:disable-next-line: object-literal-sort-keys
    fiscalCode: exports.aFiscalCode,
    choice: UserDataProcessingChoice_1.UserDataProcessingChoiceEnum.DOWNLOAD,
    status: UserDataProcessingStatus_1.UserDataProcessingStatusEnum.PENDING,
    createdAt: new Date()
}).getOrElseL(function () {
    throw new Error("Cannot decode user data processing payload.");
});
// tslint:disable-next-line: no-floating-promises
createDatabase(cosmosDbName)
    .then(function () { return createCollection("message-status", "messageId"); })
    .then(function () { return createCollection("messages", "messageId"); })
    .then(function () { return createCollection("notification-status", "notificationId"); })
    .then(function () { return createCollection("notifications", "messageId"); })
    .then(function () { return createCollection("profiles", "fiscalCode"); })
    .then(function () { return createCollection("sender-services", "recipientFiscalCode"); })
    .then(function () { return createCollection("services", "serviceId"); })
    .then(function () { return createCollection("user-data-processing", "fiscalCode"); })
    .then(function () { return serviceModel.create(aService, aService.serviceId); })
    .then(function () {
    return userDataProcessingModel.create(aUserDataProcessing, aUserDataProcessing.fiscalCode);
})
    // tslint:disable-next-line: no-console
    .then(function (s) { return console.log(s.value); })["catch"](console.error);
