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

const telemetryClient = initTelemetryClient();

const trackServiceErrorAndContinue = (
  context: Context,
  error: Error,
  fiscalCode: FiscalCode,
  messageId: string,
  serviceId: ServiceId
): Error => {
  context.log.error(
    `Cannot enrich service with id ${serviceId}|${JSON.stringify(error)}`
  );
  createTracker(telemetryClient).messages.trackServiceEnrichmentFailure(
    fiscalCode,
    messageId,
    serviceId
  );
  return E.toError(error);
};

const trackContentErrorAndContinue = (
  context: Context,
  error: Error,
  fiscalCode: FiscalCode,
  messageId: string
): Error => {
  context.log.error(
    `Cannot enrich message with id ${messageId}|${JSON.stringify(error)}`
  );
  createTracker(telemetryClient).messages.trackContentEnrichmentFailure(
    fiscalCode,
    messageId
  );
  return E.toError(error);
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
          TE.mapLeft(E.toError),
          TE.chain(TE.fromOption(() => new Error("Cannot retrieve service."))),
          TE.mapLeft(e =>
            trackServiceErrorAndContinue(
              context,
              e,
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
            trackContentErrorAndContinue(
              context,
              e,
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
