import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "italia-ts-commons/lib/strings";

import { NewProfile } from "io-functions-commons/dist/generated/definitions/NewProfile";
import { Profile } from "io-functions-commons/dist/generated/definitions/Profile";
import { UserDataProcessing } from "io-functions-commons/dist/generated/definitions/UserDataProcessing";
import {
  UserDataProcessingChoice,
  UserDataProcessingChoiceEnum
} from "io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import {
  UserDataProcessingStatus,
  UserDataProcessingStatusEnum
} from "io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import { RetrievedProfile } from "io-functions-commons/dist/src/models/profile";
import { retrievedProfileToExtendedProfile } from "../utils/profiles";

export const aEmail = "email@example.com" as EmailString;
export const aEmailChanged = "email.changed@example.com" as EmailString;

export const aFiscalCode = "SPNDNL80A13Y555X" as FiscalCode;

export const aNewProfile: NewProfile = {
  email: aEmail,
  is_email_validated: true
};

export const aProfile: Profile = {
  email: aEmail,
  is_email_enabled: true,
  is_inbox_enabled: false,
  is_webhook_enabled: false,
  version: 0 as NonNegativeNumber
};

export const aRetrievedProfile: RetrievedProfile = {
  _self: "123",
  _ts: 123,
  fiscalCode: aFiscalCode,
  id: "123" as NonEmptyString,
  isEmailEnabled: true,
  isInboxEnabled: false,
  isWebhookEnabled: false,
  kind: "IRetrievedProfile",
  version: 0 as NonNegativeNumber
};

export const aExtendedProfile = retrievedProfileToExtendedProfile(
  aRetrievedProfile
);

export const aTokenId = "01DQ79RZ0EQ0S7RTA3SMCKRCCA";
export const aValidator = "d6e57ed8d3c3eb4583d671c7";
export const aValidatorHash =
  "35aef908716592e5dd48ccc4f58ef1a286de8dfd58d9a7a050cf47c60b662154";

export const aUserDataProcessingChoice: UserDataProcessingChoice =
  UserDataProcessingChoiceEnum.DOWNLOAD;

export const aUserDataProcessingStatus: UserDataProcessingStatus =
  UserDataProcessingStatusEnum.PENDING;

export const aUserDataProcessing: UserDataProcessing = {
  id: "123" as NonEmptyString,
  // tslint:disable-next-line: object-literal-sort-keys
  fiscalCode: aFiscalCode,
  createdAt: new Date(),
  choice: aUserDataProcessingChoice,
  status: aUserDataProcessingStatus,
  version: 0 as NonNegativeNumber
};
