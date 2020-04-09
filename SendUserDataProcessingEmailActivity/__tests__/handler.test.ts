/* tslint:disable: no-any */

import { EmailString } from "italia-ts-commons/lib/strings";

import { FiscalCode } from "io-functions-commons/dist/generated/definitions/FiscalCode";
import { UserDataProcessingChoice } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { EmailDefaults } from "..";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  ActivityInput as SendValidationEmailActivityInput,
  getSendUserDataProcessingEmailActivityHandler
} from "../handler";

const aUserDataProcessingChoice = "DOWNLOAD" as UserDataProcessingChoice;
const userEmail = "email@example.com" as EmailString;
const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const htmlAndTextContent = `Con la presente si informa che e' stata effettuata la richiesta di:
  ${aUserDataProcessingChoice.toString()} dall' utente con codice fiscale ${aFiscalCode}.
  L' indirizzo e-mail dell' utente e' ${userEmail}`;

describe("SendValidationEmailActivityHandler", () => {
  it("should send the email using the input data", async () => {
    const emailDefaults: EmailDefaults = {
      from: "from@example.com" as any,
      title: "Email title",
      to: "email@example.com" as any
    };
    const mailerTransporterMock = {
      sendMail: jest.fn((_, f) => {
        f(undefined, {});
      })
    };

    const handler = getSendUserDataProcessingEmailActivityHandler(
      mailerTransporterMock as any,
      emailDefaults
    );

    const input = SendValidationEmailActivityInput.encode({
      choice: aUserDataProcessingChoice,
      email: userEmail,
      fiscalCode: aFiscalCode
    });

    await handler(contextMock as any, input);

    expect(mailerTransporterMock.sendMail).toHaveBeenCalledWith(
      {
        from: emailDefaults.from,
        subject: emailDefaults.title,
        text: htmlAndTextContent,
        to: input.email
      },
      expect.any(Function)
    );
  });
});
