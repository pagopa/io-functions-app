import { initTelemetryClient } from "../utils/appinsights";
import { getGeoLocationHandler } from "./handler";

// Initialize application insights
initTelemetryClient();

// TODO: instanciate an actual geoLocationServiceClient
const geoLocationServiceClient = {};

const activityFunctionHandler = getGeoLocationHandler(geoLocationServiceClient);

export default activityFunctionHandler;
