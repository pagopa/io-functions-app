import { ServiceCategory } from "@pagopa/io-functions-commons/dist/generated/definitions/ServiceCategory";
import { StandardServiceCategoryEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/StandardServiceCategory";
import {
  ServiceModel,
  Service
} from "@pagopa/io-functions-commons/dist/src/models/service";
import {
  IResponseErrorQuery,
  ResponseErrorQuery
} from "@pagopa/io-functions-commons/dist/src/utils/response";
import {
  IResponseErrorNotFound,
  ResponseErrorNotFound
} from "@pagopa/ts-commons/lib/responses";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { ServiceId } from "@pagopa/io-backend-sdk/ServiceId";

/**
 * Return a task containing either an error or the required Service
 */
export const getServiceOrErrorResponse = (serviceModel: ServiceModel) => (
  serviceId: ServiceId
): TE.TaskEither<IResponseErrorQuery | IResponseErrorNotFound, Service> =>
  pipe(
    serviceModel.findLastVersionByModelId([serviceId]),
    TE.mapLeft(failure =>
      ResponseErrorQuery("Error while retrieving the service", failure)
    ),
    TE.chainW(
      TE.fromOption(() =>
        ResponseErrorNotFound(
          "Service not found",
          "The service you requested was not found in the system."
        )
      )
    )
  );

/**
 * Returns the Service Category from a Service.
 * If serviceMetadata are not defined the default value STANDARD is returned.
 *
 * @param service
 * @returns ServiceCategory or StandardServiceCategoryEnum.STANDARD
 */
export const getServiceCategoryOrStandard = (
  service: Service
): ServiceCategory =>
  service.serviceMetadata?.category || StandardServiceCategoryEnum.STANDARD;
