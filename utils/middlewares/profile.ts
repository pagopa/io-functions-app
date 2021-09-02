import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";

import { ResponseErrorFromValidationErrors } from "@pagopa/ts-commons/lib/responses";

import { NewProfile } from "@pagopa/io-functions-commons/dist/generated/definitions/NewProfile";
import { Profile } from "@pagopa/io-functions-commons/dist/generated/definitions/Profile";
import { IRequestMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";

/**
 * A middleware that extracts a NewProfile payload from a request.
 */
export const NewProfileMiddleware: IRequestMiddleware<
  "IResponseErrorValidation",
  NewProfile
> = request =>
  Promise.resolve(
    pipe(
      request.body,
      NewProfile.decode,
      E.mapLeft(ResponseErrorFromValidationErrors(NewProfile))
    )
  );

/**
 * A middleware that extracts a Profile payload from a request.
 */
export const ProfileMiddleware: IRequestMiddleware<
  "IResponseErrorValidation",
  Profile
> = request =>
  Promise.resolve(
    pipe(
      request.body,
      Profile.decode,
      E.mapLeft(ResponseErrorFromValidationErrors(Profile))
    )
  );
