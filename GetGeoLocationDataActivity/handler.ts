import { Context } from "@azure/functions";
import { IPString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/function";
import { readableReportSimplified } from "@pagopa/ts-commons/lib/reporters";
import { TransientNotImplementedFailure } from "../utils/durable";
import { GeoLocationServiceClient } from "./utils";

// geo location service response
const GeoLocationServiceResponse = t.interface({
  geo_location: NonEmptyString
});

type GeoLocationServiceResponse = t.TypeOf<typeof GeoLocationServiceResponse>;

// Activity input
export const ActivityInput = t.interface({
  ip_address: IPString
});

export type ActivityInput = t.TypeOf<typeof ActivityInput>;

// Activity result
export const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS"),
  value: GeoLocationServiceResponse
});

const GeneralFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

type GeneralFailure = t.TypeOf<typeof GeneralFailure>;

const ActivityResultFailure = t.union([
  GeneralFailure,
  TransientNotImplementedFailure
]);

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);

export type ActivityResult = t.TypeOf<typeof ActivityResult>;

const logPrefix = "GetGeoLocationDataActivity";

export const getGeoLocationHandler = (
  _geoLocationService: GeoLocationServiceClient
) => async (context: Context, input: unknown): Promise<ActivityResult> =>
  pipe(
    input,
    ActivityInput.decode,
    E.mapLeft(errors => {
      context.log.error(
        `${logPrefix}|Error while decoding input|ERROR=${readableReportSimplified(
          errors
        )}`
      );

      return ActivityResultFailure.encode({
        kind: "FAILURE",
        reason: "Error while decoding input"
      });
    }),
    TE.fromEither,
    // TODO: implement the actual call to geo location service
    TE.chain(_activityInput =>
      TE.left(
        ActivityResultFailure.encode({
          kind: "NOT_YET_IMPLEMENTED",
          reason: "call not yet implemented"
        })
      )
    ),
    TE.map(serviceResponse =>
      ActivityResultSuccess.encode({
        kind: "SUCCESS",
        value: serviceResponse
      })
    ),
    TE.toUnion
  )();
