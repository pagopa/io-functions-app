import { EmailString } from "@pagopa/ts-commons/lib/strings";
import { aFiscalCode } from "./mocks";

export function generateProfileEmails(count: number, throws: boolean = false) {
  return async function*(email: EmailString) {
    if (throws) {
      throw new Error("error retriving profile emails");
    }
    for (let i = 0; i < count; i++) {
      yield { email, fiscalCode: aFiscalCode };
    }
  };
}
