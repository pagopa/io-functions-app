import { DocumentClient as DocumentDBClient } from "documentdb";

// tslint:disable-next-line: no-let
let instance: DocumentDBClient;

export function getDocumentClient(
  cosmosDbUri: string,
  cosmosDbKey: string
): DocumentDBClient {
  return instance
    ? instance
    : (instance = new DocumentDBClient(cosmosDbUri, {
        masterKey: cosmosDbKey
      }));
}
