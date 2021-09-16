import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { EnrichedMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/EnrichedMessage";
import { MessageModel } from "@pagopa/io-functions-commons/dist/src/models/message";
import { ServiceModel } from "@pagopa/io-functions-commons/dist/src/models/service";
import { BlobService } from "azure-storage";
import * as A from "fp-ts/lib/Apply";
import * as E from "fp-ts/lib/Either";
import { flow, pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";

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
) => (
  messages: readonly CreatedMessageWithoutContent[]
): Promise<E.Either<Error, EnrichedMessage>>[] =>
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
      TE.map(({ service, subject }) => ({
        ...message,
        message_title: subject,
        organization_name: service.organizationName,
        service_name: service.serviceName
      }))
    )()
  );
