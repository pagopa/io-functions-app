import * as express from "express";

import { wrapRequestHandler } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import * as packageJson from "../package.json";
import { checkApplicationHealth, HealthCheck } from "../utils/healthcheck";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";

interface IInfo {
  name: string;
  version: string;
}

type InfoHandler = () => Promise<
  IResponseSuccessJson<IInfo> | IResponseErrorInternal
>;

export function InfoHandler(healthCheck: HealthCheck): InfoHandler {
  return () =>
    pipe(
      healthCheck,
      TE.bimap(
        problems => ResponseErrorInternal(problems.join("\n\n")),
        _ =>
          ResponseSuccessJson({
            name: packageJson.name,
            version: packageJson.version
          })
      ),
      TE.toUnion
    )();
}

export function Info(): express.RequestHandler {
  const handler = InfoHandler(checkApplicationHealth());

  return wrapRequestHandler(handler);
}
