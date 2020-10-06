/* tslint:disable:no-any */
/* tslint:disable:no-object-mutation */

process.env = {
  UBSCRIPTIONS_FEED_TABLE: "feed",
  APPINSIGHTS_INSTRUMENTATIONKEY: "foo",
  QueueStorageConnection: "foobar",
  SUBSCRIPTIONS_FEED_TABLE: "feed",
  SPID_BLOB_CONTAINER_NAME: "spidblob",
  SPID_BLOB_STORAGE_CONNECTION_STRING: "foobar",
  SPID_LOGS_PUBLIC_KEY: `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDhiXpvLD8UMMUy1T2JCzo/Sj5E
l09Fs0z2U4aA37BrXlSo1DwQ2O9i2XFxXGJmE83siSWEfRlMWlabMu7Yj6dkZvmj
dGIO4gotO33TgiAQcwRo+4pwjoCN7Td47yssCcj9C727zBt+Br+XK7B1bRcqjc0J
YdF4yiVtD7G4RDXmRQIDAQAB
-----END PUBLIC KEY-----`,
  MESSAGE_CONTAINER_NAME: "msg",
  CUSTOMCONNSTR_COSMOSDB_URI: "uri",
  CUSTOMCONNSTR_COSMOSDB_KEY: "key",
  COSMOSDB_NAME: "cosmoname",
  COSMOSDB_URI: "uri",
  COSMOSDB_KEY: "key",
  FUNCTIONS_PUBLIC_URL: "url",
  PUBLIC_API_URL: "url",
  PUBLIC_API_KEY: "key",
  MAILHOG_HOSTNAME: "mailhog",
  MAIL_FROM: "mail@example.it",
  NODE_ENV: "dev",
  REQ_SERVICE_ID: "req_id_dev",
  AZURE_NH_HUB_NAME: "azhub",
  AZURE_NH_ENDPOINT: "azendpoint",
};

import { format } from "date-fns";
import { toPlainText } from "italia-ts-commons/lib/encrypt";
import { IPString } from "italia-ts-commons/lib/strings";
import { aFiscalCode } from "../../__mocks__/mocks";
import { index, IOutputBinding, SpidMsgItem } from "../index";

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

const anotherSpidMsgItem: SpidMsgItem = {
  createdAt: aDate,
  createdAtDay: today,
  fiscalCode: aFiscalCode,
  ip: "192.168.1.7" as IPString,
  requestPayload:
    "<?xml version='1.0' encoding='UTF-8'?><note ID='CCCC_DDDD'><to>Azure</to><from>Azure</from><heading>Reminder</heading><body>New append from local dev - REQUEST</body></note>",
  responsePayload:
    "<?xml version='1.0' encoding='UTF-8'?><note ID='CCCC_DDDD'><to>Azure</to><from>Azure</from><heading>Reminder</heading><body>New append from local dev - RESPONSE</body></note>",
  spidRequestId: "CCCC_DDDD"
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
    const blob = blobItem as IOutputBinding;
    const encryptedSpidBlobItem = blob.spidRequestResponse;
    const decryptedRequestPayload = toPlainText(
      aRSAPrivateKey,
      encryptedSpidBlobItem.encryptedRequestPayload
    );
    const decryptedResponsePayload = toPlainText(
      aRSAPrivateKey,
      encryptedSpidBlobItem.encryptedResponsePayload
    );
    expect(decryptedRequestPayload.value).toEqual(aSpidMsgItem.requestPayload);
    expect(decryptedResponsePayload.value).toEqual(
      aSpidMsgItem.responsePayload
    );
  });
  it("should encrypt two different messages with the same Cipher instance and decrypt with another one", async () => {
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
    const blob = blobItem as IOutputBinding;
    const encryptedSpidBlobItem = blob.spidRequestResponse;
    const decryptedRequestPayload = toPlainText(
      aRSAPrivateKey,
      encryptedSpidBlobItem.encryptedRequestPayload
    );
    const decryptedResponsePayload = toPlainText(
      aRSAPrivateKey,
      encryptedSpidBlobItem.encryptedResponsePayload
    );
    expect(decryptedRequestPayload.value).toEqual(aSpidMsgItem.requestPayload);
    expect(decryptedResponsePayload.value).toEqual(
      aSpidMsgItem.responsePayload
    );

    const anotherMockedContext = {
      bindings: {
        spidMsgItem: anotherSpidMsgItem
      },
      done: jest.fn(),
      log: {
        error: jest.fn()
      }
    };
    const secondBlobItem = await index(
      anotherMockedContext as any,
      anotherSpidMsgItem
    );
    const secondBlob = secondBlobItem as IOutputBinding;
    const secondEncryptedSpidBlobItem = secondBlob.spidRequestResponse;

    const secondDecryptedRequestPayload = toPlainText(
      aRSAPrivateKey,
      secondEncryptedSpidBlobItem.encryptedRequestPayload
    );
    const secondDecryptedResponsePayload = toPlainText(
      aRSAPrivateKey,
      secondEncryptedSpidBlobItem.encryptedResponsePayload
    );
    expect(secondDecryptedRequestPayload.value).toEqual(
      anotherSpidMsgItem.requestPayload
    );
    expect(secondDecryptedResponsePayload.value).toEqual(
      anotherSpidMsgItem.responsePayload
    );
  });
});
