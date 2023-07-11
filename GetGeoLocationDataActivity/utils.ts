import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";

// TODO: instanciate an actual geoLocationServiceClient
export const geoLocationServiceClient = {
  getGeoLocationForIp: (ip: NonEmptyString): Promise<never> =>
    Promise.reject({ status: 501, value: ip })
};

export type GeoLocationServiceClient = typeof geoLocationServiceClient;
