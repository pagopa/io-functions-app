/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable functional/immutable-data */

import { toPlainText } from "@pagopa/ts-commons/lib/encrypt";
import { IPString, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

import { format } from "date-fns";
import { isRight } from "fp-ts/lib/Either";
import { aFiscalCode } from "../../__mocks__/mocks";
import { encryptAndStore, IOutputBinding } from "../handler";
import { SpidMsgItem } from "../index";

const today = format(new Date(), "yyyy-MM-dd");
const aDate = new Date();

const aPublicKey = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC76C3tOj7lPiJ5sg2lU6j2dZEa
E9GW+v1YrOajfCHijBo6VLSMH6nrO3fZM3C8oNsYrH8jyeZlcu8ZdKMaRECegVUv
YwCyICrs58l1pA0qCo+o/0jWUaCWQY5SAX2eAni7PQGzSTQRu93Ac4BnI0PDvqxY
Q1mRn/iy0NVMMxhDUwIDAQAB
-----END PUBLIC KEY-----` as NonEmptyString;

const aRSAPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQC76C3tOj7lPiJ5sg2lU6j2dZEaE9GW+v1YrOajfCHijBo6VLSM
H6nrO3fZM3C8oNsYrH8jyeZlcu8ZdKMaRECegVUvYwCyICrs58l1pA0qCo+o/0jW
UaCWQY5SAX2eAni7PQGzSTQRu93Ac4BnI0PDvqxYQ1mRn/iy0NVMMxhDUwIDAQAB
AoGBAKmCGWwXTwWdt5vwcz7g6VrrU6oilr+MS17jGmwAXtDvcfmM0BJXvgDl9IeL
T/fZY8wuT8MJLz31IJvmC/x19ZN7gsnp/Hi5L3gouQMQFGwaDUsO10gqGEoJXJCp
kNS7PV8Zp1Z6aBg5zd4A0Hc271qOY5VUwKuT9zIzkDtHlq6BAkEA23J6jH3nEyom
4oV/oRMpX6xHm6tciFvpVXK/kZNl8rXVUj9BHbyDG59q8eZ0HcJVt8dTFGtwmxnU
Bs/v1DPlZQJBANs0yHV8wPr0Oj3dTVZ/zePMSYDXpJjWbbquM0kKcWAeyqiRC/hX
rPaum46QWn978zLCOWLvg2FroFGYzLaqNlcCQQC4ILT83sMdTHf2BweQ0nAbq4Ul
88GfVGdS4AYnEqMu5C0KZrKvTbZAXiGwuKnjMmUT37Yw4vlH2oMR+DUGO0kVAkBv
qJBfwD9w1Y0BTEQDxrAy1DGwzqeKLtfQGsIG96nOw4CJovDM/KQfN8wHL6LZg2Lb
PTIMImLy8ebFCadleIibAkBnlE+V7qUL+a/XBMazEffUVsMoPN9iv7G6UPUyOipN
hG0enuvF/PmgeLYsbFtozTm2/mQNqBV6USME39kPoKY1
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
    const blobItem = await encryptAndStore(
      mockedContext as any,
      {
        ...aSpidMsgItem,
        ip: "XX" as IPString
      },
      aPublicKey
    );
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
    const blobItem = await encryptAndStore(
      mockedContext as any,
      aSpidMsgItem,
      aPublicKey
    );
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

    if (isRight(decryptedRequestPayload) && isRight(decryptedResponsePayload)) {
      expect(decryptedRequestPayload.right).toEqual(
        aSpidMsgItem.requestPayload
      );
      expect(decryptedResponsePayload.right).toEqual(
        aSpidMsgItem.responsePayload
      );
    } else {
      expect(true).toBeFalsy();
    }
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
    const blobItem = await encryptAndStore(
      mockedContext as any,
      aSpidMsgItem,
      aPublicKey
    );
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
    if (isRight(decryptedRequestPayload) && isRight(decryptedResponsePayload)) {
      expect(decryptedRequestPayload.right).toEqual(
        aSpidMsgItem.requestPayload
      );
      expect(decryptedResponsePayload.right).toEqual(
        aSpidMsgItem.responsePayload
      );
    } else {
      expect(true).toBeFalsy();
    }

    const anotherMockedContext = {
      bindings: {
        spidMsgItem: anotherSpidMsgItem
      },
      done: jest.fn(),
      log: {
        error: jest.fn()
      }
    };
    const secondBlobItem = await encryptAndStore(
      anotherMockedContext as any,
      anotherSpidMsgItem,
      aPublicKey
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

    if (
      isRight(secondDecryptedRequestPayload) &&
      isRight(secondDecryptedResponsePayload)
    ) {
      expect(secondDecryptedRequestPayload.right).toEqual(
        anotherSpidMsgItem.requestPayload
      );
      expect(secondDecryptedResponsePayload.right).toEqual(
        anotherSpidMsgItem.responsePayload
      );
    } else {
      expect(true).toBeFalsy();
    }
  });
});
