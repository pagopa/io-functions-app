import { mapAsyncIterator } from "@pagopa/io-functions-commons/dist/src/utils/async";
import { retrievedMessageToPublic } from "@pagopa/io-functions-commons/dist/src/utils/messages";
import { FiscalCodeMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/fiscalcode";
import {
  withRequestMiddlewares,
  wrapRequestHandler
} from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorQuery,
  IResponseSuccessPageIdBasedIterator,
  ResponseErrorQuery,
  ResponsePageIdBasedIterator
} from "@pagopa/io-functions-commons/dist/src/utils/response";

import {
  filterAsyncIterator,
  flattenAsyncIterator
} from "@pagopa/io-functions-commons/dist/src/utils/async";

import {
  defaultPageSize,
  MessageModel,
  MessageWithoutContent,
  RetrievedMessage
} from "@pagopa/io-functions-commons/dist/src/models/message";

import { CreatedMessageWithoutContent } from "@pagopa/io-functions-commons/dist/generated/definitions/CreatedMessageWithoutContent";
import { EnrichedMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/EnrichedMessage";

import { OptionalQueryParamMiddleware } from "@pagopa/io-functions-commons/dist/src/utils/middlewares/optional_query_param";

import * as express from "express";
import { isRight } from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import * as t from "io-ts";

import {
  NonNegativeInteger,
  NonNegativeIntegerFromString
} from "@pagopa/ts-commons/lib/numbers";
import { BooleanFromString } from "@pagopa/ts-commons/lib/booleans";
import {
  IResponseErrorGeneric,
  IResponseErrorInternal,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorGeneric,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as O from "fp-ts/lib/Option";
import {
  Service,
  ServiceModel
} from "@pagopa/io-functions-commons/dist/src/models/service";
import { BlobService } from "azure-storage";
import { MessageContent } from "@pagopa/io-functions-commons/dist/generated/definitions/MessageContent";
import { toCosmosErrorResponse } from "@pagopa/io-functions-commons/dist/src/utils/cosmosdb_model";

type RetrievedNotPendingMessage = t.TypeOf<typeof RetrievedNotPendingMessage>;
const RetrievedNotPendingMessage = t.intersection([
  RetrievedMessage,
  t.interface({ isPending: t.literal(false) })
]);

type IGetMessagesHandlerResponse =
  | IResponseSuccessJson<PageResults>
  | IResponseErrorValidation
  | IResponseErrorInternal;

/**
 * Type of a GetMessages handler.
 *
 * GetMessages expects a FiscalCode as input and returns the Messages
 * as output or a Validation error.
 *
 */
type IGetMessagesHandler = (
  fiscalCode: FiscalCode,
  maybePageSize: O.Option<NonNegativeInteger>,
  maybeEnrichResultData: O.Option<boolean>,
  maybeMaximumId: O.Option<NonEmptyString>,
  maybeMinimumId: O.Option<NonEmptyString>
) => Promise<IGetMessagesHandlerResponse>;

/**
 * Handles requests for getting all message for a recipient.
 */
export const GetMessagesHandler = (
  messageModel: MessageModel,
  serviceModel: ServiceModel,
  blobService: BlobService
): IGetMessagesHandler => async (
  fiscalCode,
  maybePageSize,
  maybeEnrichResultData,
  maybeMaximumId,
  maybeMinimumId
) => {
  const pageSize = pipe(
    maybePageSize,
    O.getOrElse(() => defaultPageSize)
  );
  // TODO: Consider enrichResultData to enrich messages with content
  // tslint:disable-next-line:no-unused-variable no-dead-store
  const enrichResultData = pipe(
    maybeEnrichResultData,
    O.getOrElse(() => false)
  );

  const enrichMessage = enrichMessageData(
    messageModel,
    serviceModel,
    blobService
  );

  return await pipe(
    TE.Do,
    TE.bind("maximumId", () => TE.of(O.toUndefined(maybeMaximumId))),
    TE.bind("minimumId", () => TE.of(O.toUndefined(maybeMinimumId))),
    TE.chain(params =>
      messageModel.findMessages(
        fiscalCode,
        pageSize,
        params.maximumId,
        params.minimumId
      )
    ),
    TE.map(flattenAsyncIterator),
    TE.map(i => filterAsyncIterator(i, isRight)),
    TE.map(i => mapAsyncIterator(i, e => e.right)),
    TE.map(i => filterAsyncIterator(i, RetrievedNotPendingMessage.is)),
    TE.map(i => mapAsyncIterator(i, retrievedMessageToPublic)),
    TE.map(i => fillPage<CreatedMessageWithoutContent>(i, pageSize)),
    TE.chain(i =>
      TE.tryCatch(
        () => i,
        _ => void 0
      )
    ),
    TE.chain(p =>
      enrichResultData
        ? pipe(
            p.items.map((i: CreatedMessageWithoutContent) => enrichMessage(i)),
            TE.sequenceSeqArray,
            TE.map(i => ({
              ...p,
              items: i
            }))
          )
        : TE.of(p)
    ),
    TE.bimap(
      failure => ResponseErrorInternal(failure.message),
      ResponseSuccessJson
    ),
    TE.toUnion
  )();
};

/**
 * Wraps a GetMessages handler inside an Express request handler.
 */
export function GetMessages(
  messageModel: MessageModel,
  serviceModel: ServiceModel,
  blobService: BlobService
): express.RequestHandler {
  const handler = GetMessagesHandler(messageModel, serviceModel, blobService);
  const middlewaresWrap = withRequestMiddlewares(
    FiscalCodeMiddleware,
    OptionalQueryParamMiddleware("page_size", NonNegativeIntegerFromString),
    OptionalQueryParamMiddleware("enrich_result_data", BooleanFromString),
    OptionalQueryParamMiddleware("maximum_id", NonEmptyString),
    OptionalQueryParamMiddleware("minimum_id", NonEmptyString)
  );
  return wrapRequestHandler(middlewaresWrap(handler));
}

/**
 *  To try
 */
export const enrichMessageData = (
  messageModel: MessageModel,
  serviceModel: ServiceModel,
  blobService: BlobService
) => (
  message: CreatedMessageWithoutContent
): TE.TaskEither<Error, EnrichedMessage> =>
  pipe(
    TE.Do,
    TE.bind("service", () =>
      serviceModel.findLastVersionByModelId([message.sender_service_id])
    ),
    TE.mapLeft(E.toError),
    TE.bind("messageContent", () =>
      messageModel.getContentFromBlob(blobService, message.id)
    ),
    TE.map(x => {
      const content = O.getOrElse(() => ({} as MessageContent))(
        x.messageContent
      );
      const service = O.getOrElse(() => ({} as Service))(x.service);
      return {
        ...message,
        service_name: service.serviceName,
        organization_name: service.organizationName,
        message_title: content.subject
      };
    })
  );

export const PageResults = t.intersection([
  t.interface({
    hasMoreResults: t.boolean,
    items: t.readonlyArray(t.interface({ id: t.string }))
  }),
  t.partial({
    next: t.string,
    prev: t.string
  })
]);

export type PageResults = t.TypeOf<typeof PageResults>;

export const fillPage = async <T extends { readonly id: string }>(
  iter: AsyncIterator<T, T>,
  expectedPageSize: NonNegativeInteger
): Promise<PageResults> => {
  // eslint-disable-next-line functional/prefer-readonly-type
  const items: T[] = [];
  // eslint-disable-next-line functional/no-let
  let hasMoreResults: boolean = true;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await iter.next();
    if (done) {
      hasMoreResults = false;
      break;
    }
    if (items.length === expectedPageSize) {
      break;
    }
    // eslint-disable-next-line functional/immutable-data
    items.push(value);
  }

  const next = hasMoreResults
    ? pipe(
        O.fromNullable(items[items.length - 1]),
        O.map(e => e.id),
        O.toUndefined
      )
    : undefined;
  const prev = pipe(
    O.fromNullable(items[0]),
    O.map(e => e.id),
    O.toUndefined
  );
  return { hasMoreResults, items, next, prev };
};
