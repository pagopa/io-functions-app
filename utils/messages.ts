import { Context } from "@azure/functions";
import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { EnrichedMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/EnrichedMessage";
import {
  MessageContent,
  MessageContent2
} from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";
import { EUCovidCert } from "@pagopa/io-functions-commons/dist/generated/definitions/EUCovidCert";
import { ServiceId } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceId";
import { MessageModel } from "@pagopa/io-functions-commons/dist/src/models/message";
import {
  Service,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { BlobService } from "azure-storage";
import * as AR from "fp-ts/lib/Array";
import * as A from "fp-ts/lib/Apply";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/lib/Option";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { MessageCategory } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageCategory";
import { TagEnum as TagEnumBase } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageCategoryBase";
import { TagEnum as TagEnumPayment } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageCategoryPayment";
import { ITuple2, Tuple2 } from "@pagopa/ts-commons/lib/tuples";
import { createTracker } from "./tracking";
import { initTelemetryClient } from "./appinsights";
import { PaymentData } from "@pagopa/io-functions-commons/dist/generated/definitions/PaymentData";
import { IResponseErrorInternal } from "@pagopa/ts-commons/lib/responses";
import { PaymentDataWithRequiredPayee } from "@pagopa/io-functions-commons/dist/generated/definitions/PaymentDataWithRequiredPayee";
import { some } from "fp-ts/lib/ReadonlyRecord";

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

type MessageCategoryMapping = {
  tag: MessageCategory["tag"];
  pattern: t.Type<Partial<MessageContent>>;
  buildOtherCategoryProperties?: (
    m: CreatedMessageWithoutContent,
    s: Service,
    c: MessageContent
  ) => object;
};

const messageCategoryMappings: ReadonlyArray<MessageCategoryMapping> = [
  {
    tag: TagEnumBase.GREEN_PASS,
    pattern: t.interface({ eu_covid_cert: EUCovidCert })
  },
  {
    tag: TagEnumPayment.PAYMENT,
    pattern: t.interface({ payment_data: PaymentData }),
    buildOtherCategoryProperties: (_, s, c) => ({
      rptId: `${s.organizationFiscalCode}${c.payment_data.notice_number}`
    })
  }
];

export const mapMessageCategory = (
  message: CreatedMessageWithoutContent,
  service: Service,
  messageContent: MessageContent
): MessageCategory =>
  pipe(
    messageCategoryMappings
      .map(mapping =>
        pipe(
          messageContent,
          mapping.pattern.decode,
          E.fold(
            () => void 0,
            () => ({
              tag: mapping.tag,
              ...pipe(
                O.fromNullable(mapping.buildOtherCategoryProperties),
                O.fold(
                  () => ({}),
                  f => f(message, service, messageContent)
                )
              )
            })
          )
        )
      )
      .filter(MessageCategory.is),
    O.fromPredicate(arr => arr.length > 0),
    O.chain(AR.head),
    O.getOrElse(() => ({ tag: TagEnumBase.GENERIC }))
  );

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
        content: pipe(
          messageModel.getContentFromBlob(blobService, message.id),
          TE.map(O.toUndefined),
          TE.mapLeft(e =>
            trackErrorAndContinue(
              context,
              e,
              "CONTENT",
              message.fiscal_code,
              message.id
            )
          )
        ),
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
        )
      },
      A.sequenceS(TE.ApplicativePar),
      TE.map(({ service, content }) => ({
        ...message,
        category: mapMessageCategory(message, service, content),
        message_title: content.subject,
        organization_name: service.organizationName,
        service_name: service.serviceName
      }))
    )()
  );
