import * as express from "express";

import { wrapRequestHandler } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseSuccessJson,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import * as packageJson from "../package.json";

interface IPing {
  readonly name: string;
  readonly version: string;
}

type PingHandler = () => Promise<IResponseSuccessJson<IPing>>;

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function PingHandler(): PingHandler {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  return async () =>
    ResponseSuccessJson({
      name: packageJson.name,
      version: packageJson.version
    });
}

// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function Ping(): express.RequestHandler {
  const handler = PingHandler();

  return wrapRequestHandler(handler);
}
