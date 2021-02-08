/* tslint:disable: no-any */

import {
  UserDataProcessingStatus,
  UserDataProcessingStatusEnum
} from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import {
  RetrievedUserDataProcessing,
  UserDataProcessingModel
} from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { none, some } from "fp-ts/lib/Option";
import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aFiscalCode,
  aRetrievedUserDataProcessing
} from "../../__mocks__/mocks";
import { UserDataProcessingChoiceEnum } from "../../generated/backend/UserDataProcessingChoice";
import { AbortUserDataProcessingHandler } from "../handler";

beforeEach(() => {
  jest.clearAllMocks();
});

const withStatus = (
  s: UserDataProcessingStatus,
  r: RetrievedUserDataProcessing
): RetrievedUserDataProcessing => ({ ...r, status: s });
const withChoice = (
  c: UserDataProcessingChoiceEnum,
  r: RetrievedUserDataProcessing
): RetrievedUserDataProcessing => ({ ...r, choice: c });

const mockFindLastVersionByModelId = jest.fn(() =>
  taskEither.of(
    some(
      withChoice(
        UserDataProcessingChoiceEnum.DELETE,
        withStatus(
          UserDataProcessingStatusEnum.PENDING,
          aRetrievedUserDataProcessing
        )
      )
    )
  )
);
const mockUpdate = jest.fn(() =>
  taskEither.of(
    withStatus(
      UserDataProcessingStatusEnum.ABORTED,
      aRetrievedUserDataProcessing
    )
  )
);

const userDataProcessingModelMock = ({
  // ritorna un oggetto con uno stato valido
  findLastVersionByModelId: mockFindLastVersionByModelId,
  // il salvataggio è andato ok
  update: mockUpdate
} as unknown) as UserDataProcessingModel;

// use this if you mean "no matter what value you pass"
const anyChoice = UserDataProcessingChoiceEnum.DOWNLOAD;

describe("AbortUserDataProcessingHandler", () => {
  it.each`
    choice                                 | previousStatus
    ${UserDataProcessingChoiceEnum.DELETE} | ${UserDataProcessingStatusEnum.PENDING}
  `(
    "should accept an abortion on $choice requests when previous status is $previousStatus",
    async ({ previousStatus, choice }) => {
      mockFindLastVersionByModelId.mockImplementationOnce(() =>
        taskEither.of(
          some(
            withChoice(
              choice,
              withStatus(previousStatus, aRetrievedUserDataProcessing)
            )
          )
        )
      );
      const upsertUserDataProcessingHandler = AbortUserDataProcessingHandler(
        userDataProcessingModelMock
      );

      const result = await upsertUserDataProcessingHandler(
        contextMock as any,
        aFiscalCode,
        choice
      );

      expect(result.kind).toBe("IResponseSuccessAccepted");
      expect(mockUpdate).toBeCalled();
    }
  );

  it.each`
    choice                                   | previousStatus
    ${UserDataProcessingChoiceEnum.DELETE}   | ${UserDataProcessingStatusEnum.WIP}
    ${UserDataProcessingChoiceEnum.DELETE}   | ${UserDataProcessingStatusEnum.CLOSED}
    ${UserDataProcessingChoiceEnum.DELETE}   | ${UserDataProcessingStatusEnum.ABORTED}
    ${UserDataProcessingChoiceEnum.DOWNLOAD} | ${UserDataProcessingStatusEnum.PENDING}
    ${UserDataProcessingChoiceEnum.DOWNLOAD} | ${UserDataProcessingStatusEnum.WIP}
    ${UserDataProcessingChoiceEnum.DOWNLOAD} | ${UserDataProcessingStatusEnum.CLOSED}
    ${UserDataProcessingChoiceEnum.DOWNLOAD} | ${UserDataProcessingStatusEnum.ABORTED}
  `(
    "should return conflict error on $choice requests when the entity is in status $previousStatus",
    async ({ choice, previousStatus }) => {
      mockFindLastVersionByModelId.mockImplementationOnce(() =>
        taskEither.of(
          some(withStatus(previousStatus, aRetrievedUserDataProcessing))
        )
      );

      const upsertUserDataProcessingHandler = AbortUserDataProcessingHandler(
        userDataProcessingModelMock
      );

      const result = await upsertUserDataProcessingHandler(
        contextMock as any,
        aFiscalCode,
        choice
      );

      expect(result.kind).toBe("IResponseErrorConflict");
      expect(mockUpdate).not.toBeCalled();
    }
  );

  it("should return error if the update fails", async () => {
    mockUpdate.mockImplementationOnce(() => fromLeft("any cosmos error"));

    const upsertUserDataProcessingHandler = AbortUserDataProcessingHandler(
      userDataProcessingModelMock
    );

    const result = await upsertUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode,
      anyChoice
    );

    expect(result.kind).toBe("IResponseErrorQuery");
    expect(mockUpdate).toBeCalled();
  });

  it("should return not found if there is not a request already", async () => {
    mockFindLastVersionByModelId.mockImplementationOnce(() =>
      taskEither.of(none)
    );

    const upsertUserDataProcessingHandler = AbortUserDataProcessingHandler(
      userDataProcessingModelMock
    );

    const result = await upsertUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode,
      anyChoice
    );

    expect(result.kind).toBe("IResponseErrorNotFound");
    expect(mockUpdate).not.toBeCalled();
  });
});
