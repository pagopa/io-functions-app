import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

// TODO: instanciate an actual magicLinkServiceClient
export const magicLinkServiceClient = {
  getMagicCodeForUser: (
    fc: FiscalCode,
    n: NonEmptyString,
    f: NonEmptyString
  ): Promise<never> => Promise.reject({ status: 501, value: { f, fc, n } })
};

export type MagicLinkServiceClient = typeof magicLinkServiceClient;
