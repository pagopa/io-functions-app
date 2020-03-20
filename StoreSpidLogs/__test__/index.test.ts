/* tslint:disable:no-any */
/* tslint:disable:no-object-mutation */
process.env = {
  ...process.env,
  SPID_BLOB_STORAGE_CONNECTION_STRING:
    "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://fnstorage:10000/devstoreaccount1;QueueEndpoint=http://fnstorage:10001/devstoreaccount1;TableEndpoint=http://fnstorage:10002/devstoreaccount1;",
  // tslint:disable-next-line: object-literal-sort-keys
  SPID_BLOB_CONTAINER_NAME: "spidblob",
  QueueStorageConnection:
    "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://fnstorage:10000/devstoreaccount1;QueueEndpoint=http://fnstorage:10001/devstoreaccount1;TableEndpoint=http://fnstorage:10002/devstoreaccount1;"
};
import { format } from "date-fns";
import { IPString } from "italia-ts-commons/lib/strings";
import * as handler from "../index";
const today = format(new Date(), "YYYY-MM-DD");
const aSpidMsgItem = {
  createdAt: "",
  createdAtDay: today,
  ip: "192.168.1.6" as IPString,
  payload:
    "<?xml version='1.0' encoding='UTF-8'?><note ID='AAAA_BBBB'><to>Azure</to><from>Azure</from><heading>Reminder</heading><body>New append from local dev</body></note>",
  // tslint:disable-next-line: prettier
  payloadType: "REQUEST" as "REQUEST" | "RESPONSE",
  spidRequestId: "AAAA_BBBB"
};

describe("StoreSpidLogs", () => {
  it("should read a spidMsg published in azure storage queue", async () => {
    const mockedContext = {
      bindings: {
        spidmsgitem: aSpidMsgItem
      },
      done: jest.fn(),
      log: jest.fn()
    };

    await handler.index(mockedContext as any, aSpidMsgItem);

    expect(mockedContext.bindings.spidmsgitem).toEqual(aSpidMsgItem);
  });
});
