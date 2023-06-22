# IO Functions for IO App

This project implements the APIs to enable the functionalities implemented in
the IO app. The APIs are called by the app backend.
The implementation is based on the Azure Functions v4 runtime.

## Architecture

The project is structured as follows:


## Contributing

### Setup

Install the [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools).

Install the dependencies:

```bash
$ yarn install --frozen-lockfile
```

Create a file `local.settings.json` in your cloned repo, with the
following contents:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "WEBSITE_NODE_DEFAULT_VERSION": "14.16.0",
    "AzureWebJobsStorage": "<JOBS_STORAGE_CONNECTION_STRING>",
    "APPINSIGHTS_INSTRUMENTATIONKEY": "<APPINSIGHTS_KEY>",
    "MESSAGE_CONTAINER_NAME": "message-content",
    "COSMOSDB_NAME": "<COSMOSDB_DB_NAME>",
    "COSMOSDB_KEY": "<COSMOSDB_KEY>",
    "COSMOSDB_URI": "<COSMOSDB_URI>",
    "WEBHOOK_CHANNEL_URL": "<WEBHOOK_URL>",
    "QueueStorageConnection": "<QUEUES_STORAGE_CONNECTION_STRING>",
    "AssetsStorageConnection": "<ASSETS_STORAGE_CONNECTION_STRING>",
    "STATUS_ENDPOINT_URL": "<APP_BACKEND_INFO_ENDPOINT>",
    "STATUS_REFRESH_INTERVAL_MS": "<STATUS_REFRESH_INTERVAL_MS>",
    "SUBSCRIPTIONS_FEED_TABLE": "SubscriptionsFeedByDay"
  },
  "ConnectionStrings": {}
}
```
### Starting the functions runtime

```
$ yarn start
```

The server should reload automatically when the code changes.

### Starting the io-functinos-app docker image
If you are trying to run the docker images on your local environment (through the docker-compose) you must set the following variables in the `local.settings.json` file:
  * AzureWebJobsStorage
  * QueueStorageConnection
  * AssetsStorageConnection
With this **connection string** as value:
  * DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://azurite:10000/devstoreaccount1;QueueEndpoint=http://azurite:10001/devstoreaccount1;TableEndpoint=http://azurite:10002/devstoreaccount1;

The **connection string** has a default value needed to connect to Azurite, a local emulator used to provide a free local environment for testing an Azure Blob, Queue Storage, and Table Storage application.
As for docker-compose instructions, the Azurite docker image runs the Blob service on port 10000, the Queue service on port 10001 and the Table service on port 10002.
If Azurite is executed on different address or ports, the **connection string** must be changed according to the service.

These must be the other variables values for the `local.settings.json` file:
  * COSMOSDB_URI=https://cosmosdb:3000/
  * COSMOSDB_KEY=dummykey
  * COSMOSDB_NAME=testdb

The COSMOSDB_URI must be the address of the cosmos db instance specified in the docker-compose.yml file while the COSMOSDB_KEY and COSMOSDB_NAME could be totally randomic.

Then, copy `.env.example` to `.env` and fill the variables with the following mandatory variables:
 * QueueStorageConnection=**connection string**
 * LogsStorageConnection=**connection string**
 * NOTIFICATIONS_STORAGE_CONNECTION_STRING=**connection string**
 * EventsQueueStorageConnection=**connection string**
 * FN_APP_STORAGE_CONNECTION_STRING=**connection string**
 * DURABLE_FUNCTION_STORAGE_CONNECTION_STRING=**connection string**

The **connection string** is the same used for the AzureWebJobsStorage in the `local.settings.json` file.

Then you can run `docker-compose up -d` to start the containers.
