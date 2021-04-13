import * as ai from "applicationinsights";
import { identity, toString } from "fp-ts/lib/function";
import { initAppInsights } from "italia-ts-commons/lib/appinsights";
import { IntegerFromString } from "italia-ts-commons/lib/numbers";
import { NonEmptyString } from "italia-ts-commons/lib/strings";

// the internal function runtime has MaxTelemetryItem per second set to 20 by default
// @see https://github.com/Azure/azure-functions-host/blob/master/src/WebJobs.Script/Config/ApplicationInsightsLoggerOptionsSetup.cs#L29
const DEFAULT_SAMPLING_PERCENTAGE = 5;

// Avoid to initialize Application Insights more than once
export const initTelemetryClient = (env = process.env) =>
  ai.defaultClient
    ? ai.defaultClient
    : NonEmptyString.decode(env.APPINSIGHTS_INSTRUMENTATIONKEY)
        .map(k =>
          initAppInsights(k, {
            disableAppInsights: env.APPINSIGHTS_DISABLE === "true",
            samplingPercentage: IntegerFromString.decode(
              env.APPINSIGHTS_SAMPLING_PERCENTAGE
            ).getOrElse(DEFAULT_SAMPLING_PERCENTAGE)
          })
        )
        .fold(l => {
          throw new Error(`Can not init AppInsights: ${toString(l)}`);
        }, identity);
