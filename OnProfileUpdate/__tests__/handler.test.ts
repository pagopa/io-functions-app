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
    _self: "_self-96dfb60b-c09b-4044-8cb6-1405ca6732c2"
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
    _self: "_self-ba130521-8bab-4a68-a5e9-07a7e59f1f24"
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
    _self: "_self-57807630-19c0-4cbd-a53f-a9ba3c3e0660"
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
    _self: "_self-ad893263-21a5-43af-856b-88bc80fdb5a2"
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
    _self: "_self-19e3eeb9-0fc0-472b-8df9-b29eab5a2d50"
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
    _self: "_self-4b4c94d4-a350-4f27-9c76-ba669eca48a9"
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
    _self: "_self-eb28139a-f875-4276-81c5-b3f7b01f712a"
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
    _self: "_self-aa406556-b003-4387-89ef-8f127ec9b2da"
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
    _self: "_self-f43db63b-5549-403d-98a5-e781934c796f"
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
      "error handling profile with _self _self-ba130521-8bab-4a68-a5e9-07a7e59f1f24"
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
      "error handling profile with _self _self-19e3eeb9-0fc0-472b-8df9-b29eab5a2d50"
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
      "error handling profile with _self _self-19e3eeb9-0fc0-472b-8df9-b29eab5a2d50"
    );
  });
});
