import { initTelemetryClient } from "../utils/appinsights";
import { getGeoLocationHandler } from "./handler";
import { geoLocationServiceClient } from "./utils";

// Initialize application insights
initTelemetryClient();

const activityFunctionHandler = getGeoLocationHandler(geoLocationServiceClient);

export default activityFunctionHandler;
