import { Context } from "@azure/functions";
import { ContextMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/context_middleware";
import { RequiredBodyPayloadMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/required_body_payload";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/ts-commons/lib/request_middleware";
import {
  IResponseErrorInternal,
  IResponseSuccessAccepted,
  ResponseErrorInternal,
  ResponseSuccessAccepted
} from "@pagopa/ts-commons/lib/responses";
import * as df from "durable-functions";
import * as express from "express";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import { createTracker } from "../utils/tracking";
import { startOrchestrator } from "../utils/durable";
import { UserLoginParams } from "../generated/definitions/internal/UserLoginParams";
import { OrchestratorInput } from "../NoticeLoginEmailOrchestrator/handler";

/**
 * Type of the handler.
 */
type INoticeLoginEmailHandler = (
  context: Context,
  triggerPayload: UserLoginParams
) => Promise<IResponseSuccessAccepted<undefined> | IResponseErrorInternal>;

export const NoticeLoginEmailHandler = (
  _telemetryClient?: ReturnType<typeof createTracker>
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
): INoticeLoginEmailHandler => async (context, triggerPayload) => {
  const dfClient = df.getClient(context);

  const orchestratorId = `${triggerPayload.fiscal_code}-NOTICE-LOGIN-EMAIL`;

  return pipe(
    startOrchestrator(
      dfClient,
      "NoticeLoginEmailOrchestrator",
      orchestratorId,
      { ...triggerPayload, date_time: new Date() },
      OrchestratorInput
    ),
    TE.bimap(
      error =>
        ResponseErrorInternal(
          `Error while starting the orchestrator|ERROR=${error}`
        ),
      _ =>
        ResponseSuccessAccepted<undefined>(
          "Email send request has been accepted",
          undefined
        )
    ),
    TE.toUnion
  )();
};

export const NoticeLoginEmail = (
  telemetryClient?: ReturnType<typeof createTracker>
): express.RequestHandler => {
  const handler = NoticeLoginEmailHandler(telemetryClient);

  const middlewaresWrap = withRequestMiddlewares(
    // Extract Azure Functions bindings
    ContextMiddleware(),
    // Extract the body payload from the request
    RequiredBodyPayloadMiddleware(UserLoginParams)
  );

  return wrapRequestHandler(middlewaresWrap(handler));
};
