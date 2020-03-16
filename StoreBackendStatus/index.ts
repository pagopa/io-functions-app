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

export async function index(context: Context): Promise<void> {
  // fetch backend info endpoint
  const backendInfoJson = await get(statusEndpointUrl)
    .timeout(10000)
    .accept("json")
    .then(res => res.body);

  context.log.info(
    "StoreBackendStatus|BACKEND_ENDPOINT=%s|STATUS=%s",
    statusEndpointUrl,
    JSON.stringify(backendInfoJson)
  );

  // store the json into the blob storage
  // tslint:disable-next-line:no-object-mutation
  context.bindings.backendStatus = {
    ...backendInfoJson,
    last_update: new Date().toISOString(),
    refresh_interval: refreshIntervalMs
  };
}

export default index;
