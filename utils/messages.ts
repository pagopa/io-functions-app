import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { EnrichedMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/EnrichedMessage";
import { MessageModel } from "@pagopa/io-functions-commons/dist/src/models/message";
import {
  Service,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { BlobService } from "azure-storage";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as A from "fp-ts/lib/Apply";
import * as AR from "fp-ts/lib/Array";
import { flow, pipe } from "fp-ts/lib/function";
import { ResponseSuccessXml } from "@pagopa/ts-commons/lib/responses";

/**
 * This function enrich a CreatedMessageWithoutContent with
 * service's details and message's subject.
 *
 * @param messageModel
 * @param serviceModel
 * @param blobService
 * @returns
 */
export const enrichMessageData = (
  messageModel: MessageModel,
  serviceModel: ServiceModel,
  blobService: BlobService
) => (message: CreatedMessageWithoutContent) => {
  const x = pipe(
    {
      maybeService: pipe(
        serviceModel.findLastVersionByModelId([message.sender_service_id]),
        TE.mapLeft(E.toError)
      ),
      maybeMessageContent: messageModel.getContentFromBlob(
        blobService,
        message.id
      )
    },
    A.sequenceS(TE.ApplicativePar),
    TE.map(({ maybeService, maybeMessageContent }) => {
      const subject = pipe(
        maybeMessageContent,
        O.map(content => content.subject),
        O.toUndefined
      );
      const messageService = pipe(
        maybeService,
        O.map(service => ({
          organizationName: service.organizationName,
          serviceName: service.serviceName
        })),
        O.getOrElseW(() => ({
          organizationName: undefined,
          serviceName: undefined
        }))
      );
      return {
        ...message,
        message_title: subject,
        organization_name: messageService.organizationName,
        service_name: messageService.serviceName
      };
    })
  )();
  return x;
};

/**
 * This function enrich a CreatedMessageWithoutContent with
 * service's details and message's subject.
 *
 * @param messageModel
 * @param serviceModel
 * @param blobService
 * @returns
 */
export const enrichMessagesData = (
  messageModel: MessageModel,
  serviceModel: ServiceModel,
  blobService: BlobService
) => (messages: readonly CreatedMessageWithoutContent[]) =>
  messages.map(message =>
    pipe(
      {
        service: pipe(
          serviceModel.findLastVersionByModelId([message.sender_service_id]),
          TE.mapLeft(E.toError),
          TE.chain(TE.fromOption(() => new Error("Cannot retrieve service.")))
        ),
        subject: pipe(
          messageModel.getContentFromBlob(blobService, message.id),
          TE.map(
            flow(
              O.map(content => content.subject),
              O.toUndefined
            )
          )
        )
      },
      A.sequenceS(TE.ApplicativePar),
      TE.mapLeft(() => {
        console.log(`${message.id} cannot enrich`);
        console.log(messages);
        throw new Error("Cannot enrich message data");
      }),
      TE.map(({ service, subject }) => ({
        ...message,
        message_title: subject,
        organization_name: service.organizationName,
        service_name: service.serviceName
      }))
    )()
  );
