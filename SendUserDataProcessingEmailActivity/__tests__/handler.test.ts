/* tslint:disable: no-any */

import { left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { fromEither } from "fp-ts/lib/TaskEither";
import { FiscalCode } from "io-functions-commons/dist/generated/definitions/FiscalCode";
import { UserDataProcessingChoice } from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { EmailDefaults } from "..";
import { context as contextMock } from "../../__mocks__/durable-functions";
import { aRetrievedProfileWithEmail } from "../../__mocks__/mocks";
import {
  ActivityInput as SendValidationEmailActivityInput,
  getDpoEmailHtml,
  getDpoEmailSubject,
  getDpoEmailText,
  getSendUserDataProcessingEmailActivityHandler
} from "../handler";

const aUserDataProcessingChoice = "DOWNLOAD" as UserDataProcessingChoice;
const userEmail = aRetrievedProfileWithEmail.email;
const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;
const anEmailSubject = getDpoEmailSubject(
  aUserDataProcessingChoice,
  aFiscalCode
);
const anEmailText = getDpoEmailText(
  aUserDataProcessingChoice,
  aFiscalCode,
  userEmail
);
const aHtmlDocument = getDpoEmailHtml(anEmailSubject, anEmailText);

const someEmailDefaults: EmailDefaults = {
  from: "from@example.com" as any,
  to: "email@example.com" as any
};

describe("SendValidationEmailActivityHandler", () => {
  it("should send the email using the input data", async () => {
    const sendMailMock = jest.fn(() => fromEither(right("ok")));
    const findOneProfileByFiscalCodeMock = jest.fn(() =>
      fromEither(right(some(aRetrievedProfileWithEmail)))
    );

    const handler = getSendUserDataProcessingEmailActivityHandler(
      someEmailDefaults,
      sendMailMock as any,
      findOneProfileByFiscalCodeMock as any
    );

    const input = SendValidationEmailActivityInput.encode({
      choice: aUserDataProcessingChoice,
      fiscalCode: aFiscalCode
    });

    const ret = await handler(contextMock as any, input);

    expect(sendMailMock).toHaveBeenCalledWith({
      from: someEmailDefaults.from,
      html: aHtmlDocument,
      subject: anEmailSubject,
      text: anEmailText,
      to: someEmailDefaults.to
    });
    expect(ret.kind).toEqual("SUCCESS");
  });
  it("should fail if the user profile is not found", async () => {
    const sendMailMock = jest.fn(() => fromEither(right("ok")));
    const findOneProfileByFiscalCodeMock = jest.fn(() =>
      fromEither(right(none))
    );

    const handler = getSendUserDataProcessingEmailActivityHandler(
      someEmailDefaults,
      sendMailMock as any,
      findOneProfileByFiscalCodeMock as any
    );

    const input = SendValidationEmailActivityInput.encode({
      choice: aUserDataProcessingChoice,
      fiscalCode: aFiscalCode
    });

    const ret = await handler(contextMock as any, input);

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(ret.kind).toEqual("FAILURE");
  });
  it("should fail if there is an error querying user profile", async () => {
    const sendMailMock = jest.fn(() => fromEither(right("ok")));
    const findOneProfileByFiscalCodeMock = jest.fn(() =>
      fromEither(left(new Error()))
    );

    const handler = getSendUserDataProcessingEmailActivityHandler(
      someEmailDefaults,
      sendMailMock as any,
      findOneProfileByFiscalCodeMock as any
    );

    const input = SendValidationEmailActivityInput.encode({
      choice: aUserDataProcessingChoice,
      fiscalCode: aFiscalCode
    });

    const ret = await handler(contextMock as any, input);

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(ret.kind).toEqual("FAILURE");
  });

  it("should fail if there is an error sending the email", async () => {
    const sendMailMock = jest.fn(() => fromEither(left(new Error())));
    const findOneProfileByFiscalCodeMock = jest.fn(() =>
      fromEither(right(some(aRetrievedProfileWithEmail)))
    );

    const handler = getSendUserDataProcessingEmailActivityHandler(
      someEmailDefaults,
      sendMailMock as any,
      findOneProfileByFiscalCodeMock as any
    );

    const input = SendValidationEmailActivityInput.encode({
      choice: aUserDataProcessingChoice,
      fiscalCode: aFiscalCode
    });

    const ret = await handler(contextMock as any, input);

    expect(sendMailMock).toHaveBeenCalledWith({
      from: someEmailDefaults.from,
      html: aHtmlDocument,
      subject: anEmailSubject,
      text: anEmailText,
      to: someEmailDefaults.to
    });
    expect(ret.kind).toEqual("FAILURE");
  });

  it("should fail if there is an error decoding the activity input", async () => {
    const sendMailMock = jest.fn(() => fromEither(right("ok")));
    const findOneProfileByFiscalCodeMock = jest.fn(() =>
      fromEither(right(some(aRetrievedProfileWithEmail)))
    );

    const handler = getSendUserDataProcessingEmailActivityHandler(
      someEmailDefaults,
      sendMailMock as any,
      findOneProfileByFiscalCodeMock as any
    );

    const input = SendValidationEmailActivityInput.encode({
      choice: "foo" as any,
      fiscalCode: aFiscalCode
    });

    const ret = await handler(contextMock as any, input);

    expect(findOneProfileByFiscalCodeMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(ret.kind).toEqual("FAILURE");
  });
});
