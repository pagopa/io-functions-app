import nodeFetch from "node-fetch";

import { log } from "./logger";

const customHeaders = {};

export const getNodeFetch = (
  headers: Partial<typeof customHeaders> = customHeaders,
  showLogs: boolean = false
) => async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
  const headersToAdd = {
    ...(init?.headers ?? {}),
    ...customHeaders,
    ...headers
  };

  if (showLogs) {
    log("Sending request", input, headersToAdd);
  }

  const res = await ((nodeFetch as unknown) as typeof fetch)(input, {
    ...init,
    headers: headersToAdd
  });

  if (showLogs) {
    log("Result:", res);
  }

  return res;
};
