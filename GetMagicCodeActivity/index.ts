import { initTelemetryClient } from "../utils/appinsights";
import { getActivityHandler } from "./handler";

// Initialize application insights
initTelemetryClient();

// TODO: instanciate an actual magicLinkServiceClient
const magicLinkServiceClient = {};

const activityFunctionHandler = getActivityHandler(magicLinkServiceClient);

export default activityFunctionHandler;
