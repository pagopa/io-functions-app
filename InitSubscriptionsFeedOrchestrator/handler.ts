import * as t from "io-ts";

import * as df from "durable-functions";

import { IFunctionContext } from "durable-functions/lib/src/classes";

import { readableReport } from "italia-ts-commons/lib/reporters";

import { UTCISODateFromString } from "italia-ts-commons/lib/dates";

import { ServiceId } from "io-functions-commons/dist/generated/definitions/ServiceId";

import { diffBlockedServices } from "../utils/profiles";
import { UpdatedProfileEvent } from "../utils/UpdatedProfileEvent";

import { Input as UpdateServiceSubscriptionFeedActivityInput } from "../UpdateSubscriptionsFeedActivity/index";

const Input = t.interface({
  date: UTCISODateFromString
});

export const handler = function*(
  context: IFunctionContext
): IterableIterator<unknown> {
  const errorOrInput = Input.decode(context.df.getInput());
  if (errorOrInput.isLeft()) {
    context.log.error(
      `InitSubscriptionFeedOrchestrator|Invalid Input received|ORCHESTRATOR_ID=${
        context.df.instanceId
      }|ERRORS=${readableReport(errorOrInput.value)}`
    );
    return [];
  }

  const todayIso = new Date().toISOString();

  const logPrefix = `InitSubscriptionsFeedOrchestrator|TODAY=${todayIso}`;

  const res = yield context.df.callActivity("GetProfilesActivity");

  context.log.verbose(res);

  return [];
};
