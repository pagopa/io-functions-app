/* tslint:disable: no-any */

import { right } from "fp-ts/lib/Either";
import { some } from "fp-ts/lib/Option";
import { FiscalCode } from "io-functions-commons/dist/generated/definitions/FiscalCode";
import { UserDataProcessingChoice } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { EmailDefaults } from "..";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { aRetrievedProfileWithEmail } from "../../__mocks__/mocks";
import {
  ActivityInput as SendValidationEmailActivityInput,
  getSendUserDataProcessingEmailActivityHandler
} from "../handler";

const aUserDataProcessingChoice = "DOWNLOAD" as UserDataProcessingChoice;
const userEmail = aRetrievedProfileWithEmail.email;
const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const htmlAndTextContent = `Un utente di IO ha inoltrato una nuova richiesta:
  tipo richiesta: ${aUserDataProcessingChoice.toString()}
  codice fiscale: ${aFiscalCode}
  indirizzo email: ${userEmail}.`;
const anEmailSubject = "IO - Richiesta di Download/Cancellazione Dati Utente";

describe("SendValidationEmailActivityHandler", () => {
  it("should send the email using the input data", async () => {
    const emailDefaults: EmailDefaults = {
      from: "from@example.com" as any,
      to: "email@example.com" as any
    };
    const mailerTransporterMock = {
      sendMail: jest.fn((_, f) => {
        f(undefined, {});
      })
    };
    const profileModelMock = {
      findOneProfileByFiscalCode: jest.fn(() =>
        right(some(aRetrievedProfileWithEmail))
      )
    };

    const handler = getSendUserDataProcessingEmailActivityHandler(
      mailerTransporterMock as any,
      emailDefaults,
      profileModelMock as any
    );

    const input = SendValidationEmailActivityInput.encode({
      choice: aUserDataProcessingChoice,
      fiscalCode: aFiscalCode
    });

    await handler(contextMock as any, input);

    expect(mailerTransporterMock.sendMail).toHaveBeenCalledWith(
      {
        from: emailDefaults.from,
        subject: anEmailSubject,
        text: htmlAndTextContent,
        to: emailDefaults.to
      },
      expect.any(Function)
    );
  });
});
