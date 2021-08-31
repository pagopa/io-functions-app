import { errorsToReadableMessages } from "@pagopa/ts-commons/lib/reporters";
import { Errors } from "io-ts";

export const errorsToError = (errors: Errors): Error =>
  new Error(errorsToReadableMessages(errors).join(" / "));

/**
 * Proxy `toString` to replace fp-ts one, removed in v2
 */
export const toString = JSON.stringify;
