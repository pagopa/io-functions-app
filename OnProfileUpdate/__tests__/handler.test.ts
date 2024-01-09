import { handler } from "../handler";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import { TableClient } from "@azure/data-tables";
import { Container } from "@azure/cosmos";
import {
  ProfileModel,
  RetrievedProfile
} from "@pagopa/io-functions-commons/dist/src/models/profile";
import { DataTableProfileEmailsRepository } from "@pagopa/io-functions-commons/dist/src/utils/unique_email_enforcement/storage";

const mockProfileEmailTableClient = {} as TableClient;

const mockDataTableProfileEmailsRepository = new DataTableProfileEmailsRepository(
  mockProfileEmailTableClient
);

jest
  .spyOn(mockDataTableProfileEmailsRepository, "insert")
  .mockImplementation(() => Promise.resolve());

jest
  .spyOn(mockDataTableProfileEmailsRepository, "delete")
  .mockImplementation(() => Promise.resolve());

const mockContainer = {} as Container;

const mockProfileModel = new ProfileModel(mockContainer);

const mockProfiles = [
  {
    email: "Eleanore.Kuphal@example.net",
    fiscalCode: "VSFNVG14A39Y596X",
    isEmailEnabled: true,
    isEmailValidated: false,
    isInboxEnabled: false,
    isWebhookEnabled: false,
    id: "VSFNVG14A39Y596X-0000000000000000",
    version: 0,
    _rid: "pm0GALO0diBchR4AAAAAAA==",
    _self: "dbs/pm0GAA==/colls/pm0GALO0diA=/docs/pm0GALO0diBchR4AAAAAAA==/",
    _etag: '"7300a2ac-0000-0d00-0000-5e7a4e6d0000"',
    _ts: 1585073773
  },
  {
    email: "Humberto38@example.net",
    fiscalCode: "DRUQIL23A18Y188X",
    isEmailEnabled: true,
    isEmailValidated: true,
    isInboxEnabled: false,
    isWebhookEnabled: false,
    id: "DRUQIL23A18Y188X-0000000000000000",
    version: 0,
    _rid: "8fJ6ALpQWC4CAAAAAAAAAA==",
    _self: "dbs/8fJ6AA==/colls/8fJ6ALpQWC4=/docs/8fJ6ALpQWC4CAAAAAAAAAA==/",
    _etag: '"d502d23f-0000-0d00-0000-65537def0000"',
    _attachments: "attachments/",
    _ts: 1699970543
  },
  {
    email: "cittadinanzadigitale@teamdigitale.governo.it",
    fiscalCode: "ISPXNB32R82Y766D",
    isEmailEnabled: true,
    isEmailValidated: true,
    isInboxEnabled: false,
    isWebhookEnabled: false,
    id: "ISPXNB32R82Y766D-0000000000000000",
    version: 0,
    _rid: "8fJ6ALpQWC4LAAAAAAAAAA==",
    _self: "dbs/8fJ6AA==/colls/8fJ6ALpQWC4=/docs/8fJ6ALpQWC4LAAAAAAAAAA==/",
    _etag: '"df022dde-0000-0d00-0000-6553ad910000"',
    _attachments: "attachments/",
    _ts: 1699982737
  },
  {
    email: "Reed_Klocko@example.com",
    fiscalCode: "PVQEBX22A89Y092X",
    isEmailEnabled: true,
    isEmailValidated: true,
    isInboxEnabled: false,
    isWebhookEnabled: false,
    id: "PVQEBX22A89Y092X-0000000000000000",
    version: 0,
    _rid: "8fJ6ALpQWC4FAAAAAAAAAA==",
    _self: "dbs/8fJ6AA==/colls/8fJ6ALpQWC4=/docs/8fJ6ALpQWC4FAAAAAAAAAA==/",
    _etag: '"d5023743-0000-0d00-0000-65537dfb0000"',
    _attachments: "attachments/",
    _ts: 1699970555
  },
  {
    email: "derd@example.com",
    fiscalCode: "PVQEBX22A89Y092X",
    isEmailEnabled: true,
    isEmailValidated: false,
    isInboxEnabled: false,
    isWebhookEnabled: false,
    acceptedTosVersion: 1,
    id: "PVQEBX22A89Y092X-0000000000000001",
    version: 1,
    _rid: "8fJ6ALpQWC4+AAAAAAAAAA==",
    _self: "dbs/8fJ6AA==/colls/8fJ6ALpQWC4=/docs/8fJ6ALpQWC4+AAAAAAAAAA==/",
    _etag: '"3106712c-0000-0d00-0000-656990a50000"',
    _attachments: "attachments/",
    _ts: 1701417125
  },
  {
    email: "derd@example.com",
    fiscalCode: "PVQEBX22A89Y092X",
    isEmailEnabled: true,
    isEmailValidated: true,
    isInboxEnabled: false,
    isWebhookEnabled: false,
    acceptedTosVersion: 2,
    id: "PVQEBX22A89Y092X-0000000000000002",
    version: 2,
    _rid: "8fJ6ALpQWC4+AAAAAAAAAA==",
    _self: "dbs/8fJ6AA==/colls/8fJ6ALpQWC4=/docs/8fJ6ALpQWC4+AAAAAAAAAA==/",
    _etag: '"3106712c-0000-0d00-0000-656990a50000"',
    _attachments: "attachments/",
    _ts: 1701417125
  },
  {
    email: "cittadinanzadigitale@teamdigitale.governo.it",
    fiscalCode: "ISPXNB32R82Y766D",
    isEmailEnabled: true,
    isEmailValidated: true,
    isInboxEnabled: false,
    isWebhookEnabled: false,
    acceptedTosVersion: 1,
    id: "ISPXNB32R82Y766D-0000000000000001",
    version: 1,
    _rid: "8fJ6ALpQWC4NAAAAAAAAAA==",
    _self: "dbs/8fJ6AA==/colls/8fJ6ALpQWC4=/docs/8fJ6ALpQWC4NAAAAAAAAAA==/",
    _etag: '"df024fe5-0000-0d00-0000-6553adbc0000"',
    _ts: 1699982780
  },
  {
    fiscalCode: "not-valid",
    isEmailEnabled: true,
    isEmailValidated: true,
    isInboxEnabled: false,
    isWebhookEnabled: false,
    acceptedTosVersion: 1,
    id: "id",
    version: 0
  },
  {
    email: "Eleanore.Kuphal@example.net",
    fiscalCode: "VSFNVG14A39Y596X",
    isEmailEnabled: true,
    isEmailValidated: false,
    isInboxEnabled: false,
    isWebhookEnabled: false,
    id: "VSFNVG14A39Y596X-0000000000000001",
    version: 1,
    acceptedTosVersion: 0,
    _rid: "pm0GALO0diBchR4AAAAAAA==",
    _self: "dbs/pm0GAA==/colls/pm0GALO0diA=/docs/pm0GALO0diBchR4AAAAAAA==/",
    _etag: '"7300a2ac-0000-0d00-0000-5e7a4e6d0000"',
    _ts: 1585073774
  },
  {
    email: "Eleanore.Kuphal@example.net",
    fiscalCode: "VSFNVG14A39Y596X",
    isEmailEnabled: true,
    isEmailValidated: true,
    isInboxEnabled: false,
    isWebhookEnabled: false,
    id: "VSFNVG14A39Y596X-0000000000000002",
    version: 2,
    _rid: "pm0GALO0diBchR4AAAAAAA==",
    _self: "dbs/pm0GAA==/colls/pm0GALO0diA=/docs/pm0GALO0diBchR4AAAAAAA==/",
    _etag: '"7300a2ac-0000-0d00-0000-5e7a4e6d0000"',
    _ts: 1585073774
  }
];

jest.spyOn(mockProfileModel, "find").mockImplementation(([id, fiscalCode]) =>
  pipe(
    mockProfiles.find(
      profile => profile.id === id && profile.fiscalCode === fiscalCode
    ),
    foundProfile => TE.right(O.fromNullable(foundProfile as RetrievedProfile))
  )
);

const mockLogger = {
  error: jest.fn()
};

const mockDependencies = {
  dataTableProfileEmailsRepository: mockDataTableProfileEmailsRepository,
  profileModel: mockProfileModel,
  logger: mockLogger
};

describe("handler function", () => {
  it("should call get, insert and delete methods with no errors", async () => {
    const documents = mockProfiles;

    await handler(documents)(mockDependencies)();

    expect(mockProfileModel.find).toHaveBeenCalledTimes(5);
    expect(mockDataTableProfileEmailsRepository.insert).toHaveBeenCalledTimes(
      5
    );
    expect(mockDataTableProfileEmailsRepository.delete).toHaveBeenCalledTimes(
      1
    );
  });

  it("should call mockLogger.error when error in insertProfileEmail occurs", async () => {
    const mockDocuments = mockProfiles.filter(
      mockProfile => mockProfile.id === "DRUQIL23A18Y188X-0000000000000000"
    );

    jest
      .spyOn(mockDataTableProfileEmailsRepository, "insert")
      .mockImplementationOnce(() => Promise.reject(new Error("Insert error")));

    await handler(mockDocuments)(mockDependencies)();

    expect(mockLogger.error).toHaveBeenCalledWith(
      "error handling profile with _self dbs/8fJ6AA==/colls/8fJ6ALpQWC4=/docs/8fJ6ALpQWC4CAAAAAAAAAA==/"
    );
  });

  it("should call mockLogger.error when error in find occurs", async () => {
    const mockDocuments = mockProfiles.filter(
      mockProfile => mockProfile.id === "PVQEBX22A89Y092X-0000000000000001"
    );

    jest
      .spyOn(mockProfileModel, "find")
      .mockImplementationOnce(() =>
        TE.left({ kind: "COSMOS_CONFLICT_RESPONSE" })
      );

    await handler(mockDocuments)(mockDependencies)();

    expect(mockLogger.error).toHaveBeenCalledWith(
      "error handling profile with _self dbs/8fJ6AA==/colls/8fJ6ALpQWC4=/docs/8fJ6ALpQWC4+AAAAAAAAAA==/"
    );
  });

  it("should call mockLogger.error when error in deleteProfileEmail occurs", async () => {
    const mockDocuments = mockProfiles.filter(
      mockProfile => mockProfile.id === "PVQEBX22A89Y092X-0000000000000001"
    );

    jest
      .spyOn(mockDataTableProfileEmailsRepository, "delete")
      .mockImplementationOnce(() => Promise.reject(new Error("Delete error")));

    await handler(mockDocuments)(mockDependencies)();

    expect(mockLogger.error).toHaveBeenCalledWith(
      "error handling profile with _self dbs/8fJ6AA==/colls/8fJ6ALpQWC4=/docs/8fJ6ALpQWC4+AAAAAAAAAA==/"
    );
  });
});
