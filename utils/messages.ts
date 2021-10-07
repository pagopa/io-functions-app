import { Context } from "@azure/functions";
import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { EnrichedMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/EnrichedMessage";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { MessageModel } from "@pagopa/io-functions-commons/dist/src/models/message";
import { ServiceModel } from "@pagopa/io-functions-commons/dist/src/models/service";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { BlobService } from "azure-storage";
import * as A from "fp-ts/lib/Apply";
import * as E from "fp-ts/lib/Either";
import { flow, pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import { initTelemetryClient } from "./appinsights";
import { createTracker } from "./tracking";

const trackErrorAndContinue = (
  context: Context,
  error: Error,
  kind: "SERVICE" | "CONTENT",
  fiscalCode: FiscalCode,
  messageId: string,
  serviceId?: ServiceId
  // eslint-disable-next-line max-params
): Error => {
  context.log.error(`Cannot enrich message "${messageId}" | ${error}`);
  createTracker(initTelemetryClient()).messages.trackEnrichmentFailure(
    kind,
    fiscalCode,
    messageId,
    serviceId
  );
  return error;
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
  context: Context,
  messageModel: MessageModel,
  serviceModel: ServiceModel,
  blobService: BlobService
) => (
  messages: ReadonlyArray<CreatedMessageWithoutContent>
  // eslint-disable-next-line functional/prefer-readonly-type, @typescript-eslint/array-type
): Promise<E.Either<Error, EnrichedMessage>>[] =>
  messages.map(message =>
    pipe(
      {
        service: pipe(
          serviceModel.findLastVersionByModelId([message.sender_service_id]),
          TE.mapLeft(
            e => new Error(`${e.kind}, ServiceId=${message.sender_service_id}`)
          ),
          TE.chain(
            TE.fromOption(
              () =>
                new Error(
                  `EMPTY_SERVICE, ServiceId=${message.sender_service_id}`
                )
            )
          ),
          TE.mapLeft(e =>
            trackErrorAndContinue(
              context,
              e,
              "SERVICE",
              message.fiscal_code,
              message.id,
              message.sender_service_id
            )
          )
        ),
        subject: pipe(
          messageModel.getContentFromBlob(blobService, message.id),
          TE.map(
            flow(
              O.map(content => content.subject),
              O.toUndefined
            )
          ),
          TE.mapLeft(e =>
            trackErrorAndContinue(
              context,
              e,
              "CONTENT",
              message.fiscal_code,
              message.id
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
