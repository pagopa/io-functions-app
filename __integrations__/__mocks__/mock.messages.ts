import { EnrichedMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/EnrichedMessage";
import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";
import { TimeToLiveSeconds } from "@pagopa/io-functions-commons/dist/generated/definitions/TimeToLiveSeconds";

import { TagEnum as TagEnumBase } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageCategoryBase";
import { TagEnum as TagEnumPayment } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageCategoryPayment";

import { NewMessageWithContent } from "@pagopa/io-functions-commons/dist/src/models/message";
import { retrievedMessageToPublic } from "@pagopa/io-functions-commons/dist/src/utils/messages";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { aServiceID, serviceList } from "./mock.services";
import { RetrievedMessage } from "@pagopa/io-functions-commons/dist/src/models/message";
import { pipe } from "fp-ts/lib/function";

import * as RA from "fp-ts/ReadonlyArray";
import {
  MessageStatus,
  NewMessageStatus
} from "@pagopa/io-functions-commons/dist/src/models/message_status";
import { MessageStatusValueEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageStatusValue";

export const aFiscalCodeWithoutMessages = "FFLFRC74E04B157I" as FiscalCode;
export const aFiscalCodeWithMessages = "FRLFRC74E04B157I" as FiscalCode;

export const aMessageBodyMarkdown = "test".repeat(80);
export const aMessageContent = {
  markdown: aMessageBodyMarkdown,
  subject: "test".repeat(10)
};

export const aMessage: NewMessageWithContent = {
  content: aMessageContent as Omit<MessageContent, "payment_data">,
  createdAt: new Date(),
  fiscalCode: aFiscalCodeWithMessages,
  id: "A_MESSAGE_ID" as NonEmptyString,
  indexedId: "A_MESSAGE_ID" as NonEmptyString,
  isPending: false,
  kind: "INewMessageWithContent" as const,
  senderServiceId: aServiceID,
  senderUserId: "u123" as NonEmptyString,
  timeToLiveSeconds: 3600 as TimeToLiveSeconds
};

const messageListLength = 9;
export const messagesList = Array.from(
  { length: messageListLength },
  (_, i) => ({
    ...aMessage,
    id: `${aMessage.id}_${messageListLength - i - 1}` as NonEmptyString,
    indexedId: `${aMessage.id}_${messageListLength - i - 1}` as NonEmptyString
  })
);

export const messageStatusList = pipe(
  messagesList,
  RA.map(m => [
    {
      messageId: m.id,
      id: `${m.id}-${"0".repeat(15)}0`,
      version: 0,
      isArchived: false,
      isRead: false,
      status: MessageStatusValueEnum.ACCEPTED,
      updatedAt: new Date(),
      kind: "INewMessageStatus"
    },
    {
      messageId: m.id,
      id: `${m.id}-${"0".repeat(15)}1`,
      version: 1,
      isArchived: false,
      isRead: false,
      status: MessageStatusValueEnum.PROCESSED,
      updatedAt: new Date(),
      kind: "INewMessageStatus"
    }
  ]),
  RA.flatten
) as ReadonlyArray<NewMessageStatus>;

// -------

export const mockEnrichMessage = (
  message: NewMessageWithContent
): EnrichedMessage => {
  const service = serviceList.find(
    s => s.serviceId === message.senderServiceId
  );

  return {
    ...retrievedMessageToPublic((message as any) as RetrievedMessage),
    message_title: message.content.subject,
    service_name: service.serviceName,
    organization_name: service.organizationName,
    category: { tag: TagEnumBase.GENERIC },
    is_archived: false,
    is_read: false
  };
};
