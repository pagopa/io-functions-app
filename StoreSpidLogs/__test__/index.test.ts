/* tslint:disable:no-any */
/* tslint:disable:no-object-mutation */
process.env = {
  APPINSIGHTS_INSTRUMENTATIONKEY: "foo",
  QueueStorageConnection: "foobar",
  SPID_BLOB_CONTAINER_NAME: "spidblob",
  SPID_BLOB_STORAGE_CONNECTION_STRING: "foobar"
};

import { format } from "date-fns";
import { IPString } from "italia-ts-commons/lib/strings";
import { aFiscalCode } from "../../__mocks__/mocks";
import { index, SpidBlobItem, SpidMsgItem } from "../index";

const aDate = new Date();
const today = format(aDate, "YYYY-MM-DD");

const aDate = new Date();

const aSpidBlobItem: SpidBlobItem = {
  createdAt: aDate,
  ip: "192.168.1.6" as IPString,
  requestPayload:
    "<?xml version='1.0' encoding='UTF-8'?><note ID='AAAA_BBBB'><to>Azure</to><from>Azure</from><heading>Reminder</heading><body>New append from local dev - REQUEST</body></note>",
  responsePayload:
    "<?xml version='1.0' encoding='UTF-8'?><note ID='AAAA_BBBB'><to>Azure</to><from>Azure</from><heading>Reminder</heading><body>New append from local dev - RESPONSE</body></note>",
  spidRequestId: "AAAA_BBBB"
};

const aSpidMsgItem: SpidMsgItem = {
  createdAt: aDate,
  createdAtDay: today,
  fiscalCode: aFiscalCode,
  ip: "192.168.1.6" as IPString,
  requestPayload:
    "<?xml version='1.0' encoding='UTF-8'?><note ID='AAAA_BBBB'><to>Azure</to><from>Azure</from><heading>Reminder</heading><body>New append from local dev - REQUEST</body></note>",
  responsePayload:
    "<?xml version='1.0' encoding='UTF-8'?><note ID='AAAA_BBBB'><to>Azure</to><from>Azure</from><heading>Reminder</heading><body>New append from local dev - RESPONSE</body></note>",
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
    index(mockedContext as any, {
      ...aSpidMsgItem,
      ip: "XX" as IPString
    });
    expect(mockedContext.done).toHaveBeenCalledWith(expect.any(String));
  });

  it("should store a SPID request / response published into the queue", async () => {
    const mockedContext = {
      bindings: {
        spidMsgItem: aSpidMsgItem
      },
      done: jest.fn(),
      log: {
        error: jest.fn()
      }
    };
    index(mockedContext as any, aSpidMsgItem);
    expect(mockedContext.done).toHaveBeenCalledWith(null, {
      spidRequestResponse: aSpidBlobItem
    });
  });
});
