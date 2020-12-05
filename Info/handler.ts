import * as express from "express";
import { wrapRequestHandler } from "io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import * as packageJson from "../package.json";
import { checkApplicationHealth, HealthCheck } from "../utils/healthcheck";

interface IInfo {
  name: string;
  version: string;
}

type InfoHandler = () => Promise<
  IResponseSuccessJson<IInfo> | IResponseErrorInternal
>;

export function InfoHandler(_: HealthCheck): InfoHandler {
  return () =>
    Promise.resolve(
      ResponseSuccessJson({
        name: packageJson.name,
        version: packageJson.version
      })
    );
}

export function Info(): express.RequestHandler {
  const handler = InfoHandler(checkApplicationHealth());

  return wrapRequestHandler(handler);
}
