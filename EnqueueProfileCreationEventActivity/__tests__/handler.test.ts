import { Context } from "@azure/functions";
import { QueueServiceClient } from "@azure/storage-queue";
import { context } from "../../__mocks__/durable-functions";
import { aFiscalCode } from "../../__mocks__/mocks";
import {
  GetEnqueueProfileCreationEventActivityHandler,
  NewProfileInput
} from "../handler";

const mockSendMessage = jest.fn();
const mockQueueService = ({
  getQueueClient: jest
    .fn()
    .mockImplementation(() => ({ sendMessage: mockSendMessage }))
} as unknown) as QueueServiceClient;

const aQueueName = "queue_name";

const expectedMessagePayload: NewProfileInput = {
  fiscal_code: aFiscalCode
};

describe("GetEnqueueProfileCreationEventActivityHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("Should send a message if the activity input is valid", async () => {
    const handler = GetEnqueueProfileCreationEventActivityHandler(
      mockQueueService
    );
    mockSendMessage.mockImplementation(() => Promise.resolve());
    // eslint-disable-next-line no-new, no-unused-expressions
    const result = await handler((context as unknown) as Context, {
      fiscalCode: aFiscalCode,
      queueName: aQueueName
    });
    expect(result).toEqual("SUCCESS");
    expect(mockSendMessage).toBeCalledWith(
      Buffer.from(JSON.stringify(expectedMessagePayload)).toString("base64")
    );
    expect(mockQueueService.getQueueClient).toBeCalledWith(aQueueName);
  });

  it("Should return permanent error when the input is invalid", async () => {
    const handler = GetEnqueueProfileCreationEventActivityHandler(
      mockQueueService
    );
    mockSendMessage.mockImplementation(() => Promise.resolve());
    // eslint-disable-next-line no-new, no-unused-expressions
    const result = await handler((context as unknown) as Context, {
      fiscalCode: aFiscalCode
    });
    expect(result).toEqual("FAILURE");
    expect(context.log.error).toBeCalled();
    expect(mockQueueService.getQueueClient).not.toBeCalled();
  });

  it("Should return transient error if queue service fail", async () => {
    const handler = GetEnqueueProfileCreationEventActivityHandler(
      mockQueueService
    );
    mockSendMessage.mockImplementationOnce(() =>
      Promise.reject(new Error("Error"))
    );
    // eslint-disable-next-line no-new, no-unused-expressions
    await expect(
      handler((context as unknown) as Context, {
        fiscalCode: aFiscalCode,
        queueName: aQueueName
      })
    ).rejects.toEqual(expect.any(Error));
    expect(mockQueueService.getQueueClient).toBeCalledWith(aQueueName);
    expect(mockSendMessage).toBeCalledWith(
      Buffer.from(JSON.stringify(expectedMessagePayload)).toString("base64")
    );
    expect(context.log.error).toBeCalled();
  });
});
