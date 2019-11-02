import { ResponseErrorFromValidationErrors } from "italia-ts-commons/lib/responses";

import { NewProfile } from "io-functions-commons/dist/generated/definitions/NewProfile";
import { Profile } from "io-functions-commons/dist/generated/definitions/Profile";
import { IRequestMiddleware } from "io-functions-commons/dist/src/utils/request_middleware";

/**
 * A middleware that extracts a NewProfile payload from a request.
 */
export const NewProfileMiddleware: IRequestMiddleware<
  "IResponseErrorValidation",
  NewProfile
> = request =>
  Promise.resolve(
    NewProfile.decode(request.body).mapLeft(
      ResponseErrorFromValidationErrors(NewProfile)
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
    Profile.decode(request.body).mapLeft(
      ResponseErrorFromValidationErrors(Profile)
    )
  );
