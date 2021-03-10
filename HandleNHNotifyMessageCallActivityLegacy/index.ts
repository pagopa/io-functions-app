import { getCallNHNotifyMessageActivityHandler } from "./handler";

const activityFunctionHandler = getCallNHNotifyMessageActivityHandler();

export const activityName = "HandleNHNotifyMessageCallActivityLegacy";

export default activityFunctionHandler;
