/* tslint:disable:no-any */
/* tslint:disable:no-object-mutation */

process.env = {
  QueueStorageConnection: "foobar",
  RSA_PUBLIC_KEY: `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDhiXpvLD8UMMUy1T2JCzo/Sj5E
l09Fs0z2U4aA37BrXlSo1DwQ2O9i2XFxXGJmE83siSWEfRlMWlabMu7Yj6dkZvmj
dGIO4gotO33TgiAQcwRo+4pwjoCN7Td47yssCcj9C727zBt+Br+XK7B1bRcqjc0J
YdF4yiVtD7G4RDXmRQIDAQAB
-----END PUBLIC KEY-----`,
  SPID_BLOB_CONTAINER_NAME: "spidblob",
  SPID_BLOB_STORAGE_CONNECTION_STRING: "foobar"
};

import { format } from "date-fns";
import { IPString } from "italia-ts-commons/lib/strings";
import * as NodeRSA from "node-rsa";
import { aFiscalCode } from "../../__mocks__/mocks";
import { index, IOutputBinding, SpidBlobItem, SpidMsgItem } from "../index";

const today = format(new Date(), "YYYY-MM-DD");
const aDate = new Date();

const aRSAPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQDhiXpvLD8UMMUy1T2JCzo/Sj5El09Fs0z2U4aA37BrXlSo1DwQ
2O9i2XFxXGJmE83siSWEfRlMWlabMu7Yj6dkZvmjdGIO4gotO33TgiAQcwRo+4pw
joCN7Td47yssCcj9C727zBt+Br+XK7B1bRcqjc0JYdF4yiVtD7G4RDXmRQIDAQAB
AoGAJlqjyI4kuAFHN8rNqSWQpTyx9CYrI/ZG60jvAbGIpemnygI1qMPLierigN2u
Gh/aEBSOncZMbBCc083IkmlzlKy3gJH0shgBQrfqGFbqh3i7f/lHkL+lZtXW+fF4
bXo4vdaArHhQW1oKQOHA9BO8uuqCOEaA7OtVLWiZxqe9u80CQQDyuNWZLqlDZT8c
yB6mnLh7KVGY1RYphY0HputmC3Z0qr+bAFT8plNB2SkJwsnD2YSpOj4jzzePZShP
aDNS+LQzAkEA7d/6rtzYVqX4XEvmrdQwXKvq937MgRec7Q6jzmSHSHxBLcsvJ40n
xiBoe1TJWGn866Ug/tBauF8Ws5SgCPVDpwJBAOZc9pzD5HHKjfPLGwwWgiCiPodG
9hnCXu98RL488tgXlnKOBhsj4LEGYiSZctUmhPn4BTIHYTv/ThrPUqbU1HECQDAg
/UucC3mcox+pi8boA9D8R9JDqYUFDg84wxPjayvTWCy3y5apDL8dl4Y8pXBqIW5c
PszPw0tCkglLrQWi+kkCQDzR5FI2eGvXYdkJdAqofbEFDdP+N0ZMWdJITVntrhZO
zsAyYUBrD/FpfHSA5UY9UsldiilvJeCzYbM6Rm1fpmc=
-----END RSA PRIVATE KEY-----`;

const decryptWithRsaPrivateKey = (encrypted: string) => {
  const key = new NodeRSA(aRSAPrivateKey);
  return Buffer.from(key.decrypt(encrypted)).toString("utf-8");
};

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
    const blobItem = await index(mockedContext as any, {
      ...aSpidMsgItem,
      ip: "XX" as IPString
    });
    expect(blobItem).toBeUndefined();
  });

  it("should store both SPID request/response published into the queue", async () => {
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
    expect(blobItem).toHaveProperty("spidRequestResponse");
    const blob = blobItem as IOutputBinding;
    const reqRes = JSON.parse(
      decryptWithRsaPrivateKey(blob.spidRequestResponse)
    );
    const decryptedSpidBlobItem: SpidBlobItem = {
      createdAt: aDate,
      ip: reqRes.ip as IPString,
      requestPayload: reqRes.requestPayload,
      responsePayload: reqRes.responsePayload,
      spidRequestId: reqRes.spidRequestId
    };
    const decryptedBlobItem = {
      spidRequestResponse: decryptedSpidBlobItem
    };
    expect(decryptedBlobItem).toEqual({
      spidRequestResponse: aSpidBlobItem
    });
  });
});
