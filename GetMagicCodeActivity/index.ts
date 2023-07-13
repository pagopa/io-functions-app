import { initTelemetryClient } from "../utils/appinsights";
import { magicLinkServiceClient } from "./utils";
import { getActivityHandler } from "./handler";

// Initialize application insights
initTelemetryClient();

const activityFunctionHandler = getActivityHandler(magicLinkServiceClient);

export default activityFunctionHandler;
