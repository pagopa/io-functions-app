/* tslint:disable: no-any */

import { none, some } from "fp-ts/lib/Option";
import { fromLeft, taskEither } from "fp-ts/lib/TaskEither";
import {
  UserDataProcessingStatus,
  UserDataProcessingStatusEnum
} from "io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import {
  RetrievedUserDataProcessing,
  UserDataProcessingModel
} from "io-functions-commons/dist/src/models/user_data_processing";
import { context as contextMock } from "../../__mocks__/durable-functions";
import {
  aFiscalCode,
  aRetrievedUserDataProcessing
} from "../../__mocks__/mocks";
import { AbortUserDataProcessingDeleteHandler } from "../handler";

beforeEach(() => {
  jest.clearAllMocks();
});

const withStatus = (
  s: UserDataProcessingStatus,
  r: RetrievedUserDataProcessing
): RetrievedUserDataProcessing => ({ ...r, status: s });

const mockFindLastVersionByModelId = jest.fn(() =>
  taskEither.of(
    some(
      withStatus(
        UserDataProcessingStatusEnum.PENDING,
        aRetrievedUserDataProcessing
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

describe("AbortUserDataProcessingDeleteHandler", () => {
  it.each`
    abortableStatus
    ${UserDataProcessingStatusEnum.PENDING}
    ${UserDataProcessingStatusEnum.ABORTED}
  `(
    "should accept an abortion when the process can be aborted",
    async ({ abortableStatus }) => {
      mockFindLastVersionByModelId.mockImplementationOnce(() =>
        taskEither.of(
          some(withStatus(abortableStatus, aRetrievedUserDataProcessing))
        )
      );
      const upsertUserDataProcessingHandler = AbortUserDataProcessingDeleteHandler(
        userDataProcessingModelMock
      );

      const result = await upsertUserDataProcessingHandler(
        contextMock as any,
        aFiscalCode
      );

      expect(result.kind).toBe("IResponseSuccessAccepted");
      expect(mockUpdate).toBeCalled();
    }
  );

  it("should return error if the update fails", async () => {
    mockUpdate.mockImplementationOnce(() => fromLeft("any cosmos error"));

    const upsertUserDataProcessingHandler = AbortUserDataProcessingDeleteHandler(
      userDataProcessingModelMock
    );

    const result = await upsertUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode
    );

    expect(result.kind).toBe("IResponseErrorQuery");
    expect(mockUpdate).toBeCalled();
  });

  it.each`
    unabortableStatus
    ${UserDataProcessingStatusEnum.WIP}
    ${UserDataProcessingStatusEnum.CLOSED}
  `(
    "should return conflict error when the entity is in status $unabortableStatus",
    async ({ unabortableStatus }) => {
      mockFindLastVersionByModelId.mockImplementationOnce(() =>
        taskEither.of(
          some(withStatus(unabortableStatus, aRetrievedUserDataProcessing))
        )
      );

      const upsertUserDataProcessingHandler = AbortUserDataProcessingDeleteHandler(
        userDataProcessingModelMock
      );

      const result = await upsertUserDataProcessingHandler(
        contextMock as any,
        aFiscalCode
      );

      expect(result.kind).toBe("IResponseErrorConflict");
      expect(mockUpdate).not.toBeCalled();
    }
  );

  it("should return not found if there is not a request already", async () => {
    mockFindLastVersionByModelId.mockImplementationOnce(() =>
      taskEither.of(none)
    );

    const upsertUserDataProcessingHandler = AbortUserDataProcessingDeleteHandler(
      userDataProcessingModelMock
    );

    const result = await upsertUserDataProcessingHandler(
      contextMock as any,
      aFiscalCode
    );

    expect(result.kind).toBe("IResponseErrorNotFound");
    expect(mockUpdate).not.toBeCalled();
  });
});
