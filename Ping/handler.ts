import * as express from "express";
import { wrapRequestHandler } from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseSuccessJson,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import * as packageJson from "../package.json";

interface IPing {
  name: string;
  version: string;
}

type PingHandler = () => Promise<IResponseSuccessJson<IPing>>;

export function PingHandler(): PingHandler {
  return async () =>
    ResponseSuccessJson({
      name: packageJson.name,
      version: packageJson.version
    });
}

export function Ping(): express.RequestHandler {
  const handler = PingHandler();

  return wrapRequestHandler(handler);
}
