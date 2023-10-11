import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import nodeFetch from "node-fetch";
import {
  Client,
  createClient
} from "../generated/definitions/ioweb-function/client";

export const getMagicLinkServiceClient = (
  magicLinkServiceBaseUrl: NonEmptyString,
  token: NonEmptyString,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchApi: typeof fetch = (nodeFetch as unknown) as typeof fetch
): Client<"ApiKeyAuth"> =>
  createClient({
    baseUrl: magicLinkServiceBaseUrl,
    fetchApi,
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    withDefaults: op => params =>
      op({
        ...params,
        ApiKeyAuth: token
      })
  });

export type MagicLinkServiceClient = ReturnType<
  typeof getMagicLinkServiceClient
>;
