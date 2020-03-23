/* tslint:disable:no-any */
/* tslint:disable:no-object-mutation */

process.env = {
  QueueStorageConnection: "foobar",
  SPID_BLOB_CONTAINER_NAME: "spidblob",
  SPID_BLOB_STORAGE_CONNECTION_STRING: "foobar"
};

import { format } from "date-fns";
import { IPString } from "italia-ts-commons/lib/strings";
import { aFiscalCode } from "../../__mocks__/mocks";
import { index, SpidBlobItem, SpidMsgItem } from "../index";

const today = format(new Date(), "YYYY-MM-DD");

const aSpidBlobItem: SpidBlobItem = {
  createdAt: new Date(),
  ip: "192.168.1.6" as IPString,
  payload:
    "<?xml version='1.0' encoding='UTF-8'?><note ID='AAAA_BBBB'><to>Azure</to><from>Azure</from><heading>Reminder</heading><body>New append from local dev</body></note>",
  // tslint:disable-next-line: prettier
  payloadType: "REQUEST" as "REQUEST" | "RESPONSE",
  spidRequestId: "AAAA_BBBB"
};

const aSpidMsgItem: SpidMsgItem = {
  createdAt: new Date(),
  createdAtDay: today,
  fiscalCode: aFiscalCode,
  ip: "192.168.1.6" as IPString,
  payload:
    "<?xml version='1.0' encoding='UTF-8'?><note ID='AAAA_BBBB'><to>Azure</to><from>Azure</from><heading>Reminder</heading><body>New append from local dev</body></note>",
  // tslint:disable-next-line: prettier
  payloadType: "REQUEST" as "REQUEST" | "RESPONSE",
  spidRequestId: "AAAA_BBBB"
};

describe("StoreSpidLogs", () => {
  it("should fail on invalid payload published into the queue", async () => {
    const mockedContext = {
      bindings: {
        spidMsgItem: aSpidMsgItem
      },
      done: jest.fn(),
      log: {
        error: jest.fn()
      }
    };
    const blobItem = await index(mockedContext as any, {
      ...aSpidMsgItem,
      ip: "XX" as IPString
    });
    expect(blobItem).toBeUndefined();
  });

  it("should store a SPID request published into the queue", async () => {
    const mockedContext = {
      bindings: {
        spidMsgItem: aSpidMsgItem
      },
      done: jest.fn(),
      log: {
        error: jest.fn()
      }
    };
    const blobItem = await index(mockedContext as any, aSpidMsgItem);
    expect(blobItem).toEqual(aSpidBlobItem);
    expect((mockedContext.bindings as any).spidRequest).toEqual(aSpidBlobItem);
  });

  it("should store a SPID response published into the queue", async () => {
    const mockedContext = {
      bindings: {
        spidMsgItem: aSpidMsgItem
      },
      done: jest.fn(),
      log: {
        error: jest.fn()
      }
    };
    const blobItem = await index(mockedContext as any, {
      ...aSpidMsgItem,
      payloadType: "RESPONSE"
    });
    expect(blobItem).toEqual({
      ...aSpidBlobItem,
      payloadType: "RESPONSE"
    });
    expect((mockedContext.bindings as any).spidResponse).toEqual({
      ...aSpidBlobItem,
      payloadType: "RESPONSE"
    });
  });
});
