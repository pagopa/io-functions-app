import { getCallNHCreateOrUpdateInstallationActivityHandler } from "./handler";

const activityFunctionHandler = getCallNHCreateOrUpdateInstallationActivityHandler();

export const activityName =
  "HandleNHCreateOrUpdateInstallationCallActivityLegacy";

export default activityFunctionHandler;
