import * as df from "durable-functions";
import { getConfigOrThrow } from "../utils/config";

import { getHandler } from "./handler";

const config = getConfigOrThrow();

const handler = getHandler(config);
const orchestrator = df.orchestrator(handler);

export default orchestrator;
