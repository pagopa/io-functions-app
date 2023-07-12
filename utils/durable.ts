import { PromiseType } from "@pagopa/ts-commons/lib/types";
import { DurableOrchestrationClient } from "durable-functions/lib/src/durableorchestrationclient";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/function";
import * as df from "durable-functions";
import * as t from "io-ts";

/**
 * Util function that takes a generator and executes each step until is done.
 * It is meant to be a test utility
 *
 * @param gen a generator function
 * @returns the last value yielded by the generator
 */
export const consumeGenerator = <TReturn = unknown>(
  gen: Generator<unknown, TReturn, unknown>
): TReturn => {
  // eslint-disable-next-line functional/no-let
  let prevValue: unknown;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = gen.next(prevValue);
    if (done) {
      return value;
    }
    prevValue = value;
  }
};

export const isOrchestratorRunning = (
  client: DurableOrchestrationClient,
  orchestratorId: string
): TE.TaskEither<
  Error,
  PromiseType<ReturnType<typeof client["getStatus"]>> & {
    readonly isRunning: boolean;
  }
> =>
  pipe(
    TE.tryCatch(() => client.getStatus(orchestratorId), E.toError),
    TE.map(status => ({
      ...status,
      isRunning:
        status.runtimeStatus === df.OrchestrationRuntimeStatus.Running ||
        status.runtimeStatus === df.OrchestrationRuntimeStatus.Pending
    }))
  );

/**
 * Check if the orchestrator is not running or pending, running it otherwise
 *
 * @param {DurableOrchestrationClient} dfClient
 * @param {string} orchestratorName
 * @param {string} orchestratorId
 * @param {unknown} orchestratorInput
 * @returns a TaskEither with a startup Error or instanceId
 * */
export const startOrchestrator = (
  dfClient: DurableOrchestrationClient,
  orchestratorName: string,
  orchestratorId: string,
  orchestratorInput: unknown
): TE.TaskEither<Error, string> =>
  pipe(
    isOrchestratorRunning(dfClient, orchestratorId),
    TE.chain(errorOrOrchestratorStatus =>
      !errorOrOrchestratorStatus.isRunning
        ? TE.tryCatch(
            () =>
              dfClient.startNew(
                orchestratorName,
                orchestratorId,
                orchestratorInput
              ),
            E.toError
          )
        : // if the orchestrator is already running, just return the id
          TE.of(orchestratorId)
    )
  );

/** Transient error that describes a NOT_YET_IMPLEMENTED , currently used
 * in the activities that retrieve the magic code and geolocation data during
 * a login email sending flow
 * */
export const TransientNotImplementedFailure = t.interface({
  kind: t.literal("NOT_YET_IMPLEMENTED"),
  reason: t.string
});
export type TransientNotImplementedFailure = t.TypeOf<
  typeof TransientNotImplementedFailure
>;
