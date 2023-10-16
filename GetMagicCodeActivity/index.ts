import { Millisecond } from "@pagopa/ts-commons/lib/units";
import { initTelemetryClient } from "../utils/appinsights";
import { getConfigOrThrow } from "../utils/config";
import { getTimeoutFetch } from "../utils/fetch";
import { getMagicLinkServiceClient } from "./utils";
import { getActivityHandler } from "./handler";

// HTTP external requests timeout in milliseconds
const REQUEST_TIMEOUT_MS = 5000;

const config = getConfigOrThrow();

const timeoutFetch = getTimeoutFetch(REQUEST_TIMEOUT_MS as Millisecond);

// Initialize application insights
initTelemetryClient();

const activityFunctionHandler = getActivityHandler(
  getMagicLinkServiceClient(
    config.MAGIC_LINK_SERVICE_PUBLIC_URL,
    config.MAGIC_LINK_SERVICE_API_KEY,
    timeoutFetch
  )
);

export default activityFunctionHandler;
