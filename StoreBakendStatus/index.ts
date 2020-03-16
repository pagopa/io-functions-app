/**
 * Store backend uptime status info into a static JSON
 * stored into a blob storage served by a public CDN.
 *
 */
import { Context } from "@azure/functions";
import { getRequiredStringEnv } from "io-functions-commons/dist/src/utils/env";
import { get } from "superagent";

const statusEndpointUrl = getRequiredStringEnv("STATUS_ENDPOINT_URL");
const refreshIntervalMs = getRequiredStringEnv("STATUS_REFRESH_INTERVAL_MS");

type IStoreBackendStatusHandler = (context: Context) => Promise<void>;

export function StoreBackendStatusHandler(): IStoreBackendStatusHandler {
  return async context => {
    // fetch backend info endpoint
    const backendInfoJson = await get(statusEndpointUrl)
      .timeout(10000)
      .accept("json")
      .then(res => res.body);

    // store the json into the blob storage
    // tslint:disable-next-line:no-object-mutation
    context.bindings.backendStatus = {
      ...backendInfoJson,
      last_update: new Date().toISOString(),
      refresh_interval: refreshIntervalMs
    };
  };
}

export default StoreBackendStatusHandler;
