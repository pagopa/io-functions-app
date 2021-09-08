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
import { pipe } from "fp-ts/lib/function";
import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";

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
) => (
  message: CreatedMessageWithoutContent
): Promise<E.Either<Error, EnrichedMessage>> =>
  pipe(
    TE.Do,
    TE.bind("maybeService", () =>
      serviceModel.findLastVersionByModelId([message.sender_service_id])
    ),
    TE.mapLeft(E.toError),
    TE.bind("maybeMessageContent", () =>
      messageModel.getContentFromBlob(blobService, message.id)
    ),
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
