import { ServiceResponse, TableService } from "azure-storage";
import { left, right } from "fp-ts/lib/Either";
import { none, some } from "fp-ts/lib/Option";
import { deleteTableEntity, insertTableEntity } from "../storage";

const mockInsertEntity = jest.fn();
const mockDeleteEntity = jest.fn();
const mockTableService = ({
  deleteEntity: mockDeleteEntity,
  insertEntity: mockInsertEntity
} as unknown) as TableService;

const genericError = new Error("Generic Error");
const aTableName = "table";
const anEntityDescriptor = {
  prop: "value"
};
const anErrorResponse: ServiceResponse = {
  isSuccessful: false,
  md5: "md5",
  statusCode: 404
};
const aSuccessResponse: ServiceResponse = {
  body: JSON.stringify(anEntityDescriptor),
  isSuccessful: true,
  md5: "md5",
  statusCode: 200
};

describe("insertTableEntity", () => {
  it.each`
    title                                                      | error           | result                | response            | e1                           | e2
    ${"returns an error if insertEntity fail"}                 | ${genericError} | ${null}               | ${null}             | ${left(genericError)}        | ${null}
    ${"returns an error if insertEntity fail with a response"} | ${genericError} | ${null}               | ${anErrorResponse}  | ${left(genericError)}        | ${anErrorResponse}
    ${"returns an error if insertEntity fail with no error"}   | ${null}         | ${null}               | ${anErrorResponse}  | ${left(expect.any(Error))}   | ${anErrorResponse}
    ${"returns the response value if insertEntity succeded"}   | ${null}         | ${anEntityDescriptor} | ${aSuccessResponse} | ${right(anEntityDescriptor)} | ${aSuccessResponse}
  `("should $title", async ({ error, result, response, e1, e2 }) => {
    mockInsertEntity.mockImplementationOnce((_, __, callback) =>
      callback(error, result, response)
    );
    const insertResponse = await insertTableEntity(
      mockTableService,
      aTableName
    )(anEntityDescriptor);
    expect(mockInsertEntity).toBeCalledWith(
      aTableName,
      anEntityDescriptor,
      expect.any(Function)
    );
    expect(insertResponse.e1).toEqual(e1);
    expect(insertResponse.e2).toEqual(e2);
  });
});

describe("deleteTableEntity", () => {
  it.each`
    title                                                      | error           | response            | e1                         | e2
    ${"returns an error if deleteEntity fail"}                 | ${genericError} | ${null}             | ${some(genericError)}      | ${null}
    ${"returns an error if deleteEntity fail with a response"} | ${genericError} | ${anErrorResponse}  | ${some(genericError)}      | ${anErrorResponse}
    ${"returns an error if deleteEntity fail with no error"}   | ${null}         | ${anErrorResponse}  | ${some(expect.any(Error))} | ${anErrorResponse}
    ${"returns the response value if deleteEntity succeded"}   | ${null}         | ${aSuccessResponse} | ${none}                    | ${aSuccessResponse}
  `("should $title", async ({ error, response, e1, e2 }) => {
    mockDeleteEntity.mockImplementationOnce((_, __, callback) =>
      callback(error, response)
    );
    const deleteResponse = await deleteTableEntity(
      mockTableService,
      aTableName
    )(anEntityDescriptor);
    expect(mockDeleteEntity).toBeCalledWith(
      aTableName,
      anEntityDescriptor,
      expect.any(Function)
    );
    expect(deleteResponse.e1).toEqual(e1);
    expect(deleteResponse.e2).toEqual(e2);
  });
});
