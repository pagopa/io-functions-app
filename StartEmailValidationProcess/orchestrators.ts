import * as df from "durable-functions";
import { DurableOrchestrationClient } from "durable-functions/lib/src/durableorchestrationclient";

import * as dateFns from "date-fns";
import { toError } from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { PromiseType } from "@pagopa/ts-commons/lib/types";
import { EmailAddress } from "../generated/backend/EmailAddress";
import { toHash } from "../utils/crypto";

/**
 
 * The identifier for EmailValidationProcessOrchestrator
 *
 * @param fiscalCode the id of the requesting user
 * @param email the user's email
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const makeStartEmailValidationProcessOrchestratorId = (
  fiscalCode: FiscalCode,
  email: EmailAddress,
  creationDate: Date = new Date()
) =>
  toHash(
    `${dateFns.format(creationDate, "dd/MM/yyyy")}-${fiscalCode}-${email}`
  );

/**
 * Returns the status of the orchestrator augmented with an isRunning attribute
 */
export const isOrchestratorRunning = (
  client: DurableOrchestrationClient,
  orchestratorId: string
): TE.TaskEither<
  Error,
  PromiseType<ReturnType<typeof client["getStatus"]>> & {
    // eslint-disable-next-line functional/prefer-readonly-type
    isRunning: boolean;
  }
> =>
  pipe(
    TE.tryCatch(() => client.getStatus(orchestratorId), toError),
    TE.map(status => ({
      ...status,
      isRunning:
        status.runtimeStatus === df.OrchestrationRuntimeStatus.Running ||
        status.runtimeStatus === df.OrchestrationRuntimeStatus.Pending
    }))
  );
