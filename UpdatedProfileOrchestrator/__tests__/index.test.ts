// tslint:disable:no-any no-console
import * as df from "durable-functions";

import { NonNegativeNumber } from "italia-ts-commons/lib/numbers";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "italia-ts-commons/lib/strings";

import { RetrievedProfile } from "io-functions-commons/dist/src/models/profile";

import { handler } from "../index";

const fakeContext = {
  df: {
    getInput: () => ({})
  },
  log: {
    error: console.error,
    verbose: console.log,
    warn: console.warn
  }
} as any;

const aFiscalCode = "FRLFRC74E04B157I" as FiscalCode;

const aRetrievedProfile: RetrievedProfile = {
  _self: "123",
  _ts: 123,
  acceptedTosVersion: 1 as NonNegativeNumber,
  email: "x@example.com" as EmailString,
  fiscalCode: aFiscalCode,
  id: "123" as NonEmptyString,
  isInboxEnabled: false,
  isWebhookEnabled: false,
  kind: "IRetrievedProfile",
  version: 1 as NonNegativeNumber
};

beforeEach(() => {
  (df.getClient as any).mockClear();
  (df as any).mockStartNew.mockClear();
});

describe("UpdatedProfileOrchestrator", () => {
  it("should return immediately on invalid input", () => {
    const h = handler(fakeContext);
    expect(h.next()).toEqual({
      done: true,
      value: []
    });
  });

  it("should start the WelcomeMessagesActivity on newly created profiles", () => {
    const newProfile = { ...aRetrievedProfile, isInboxEnabled: true };
    const c = {
      ...fakeContext,
      df: {
        callActivity: jest.fn(),
        getInput: () => ({
          newProfile
        })
      }
    };
    const h = handler(c);
    expect(h.next()).toEqual({
      done: false,
      value: undefined
    });
    expect(c.df.callActivity).toHaveBeenCalledTimes(1);
    expect(c.df.callActivity).toHaveBeenCalledWith("WelcomeMessagesActivity", {
      profile: newProfile
    });
    expect(h.next()).toEqual({
      done: true,
      value: []
    });
  });

  it("should start the WelcomeMessagesActivity when inbox gets enabled on existing profiles", () => {
    const newProfile = { ...aRetrievedProfile, isInboxEnabled: true };
    const c = {
      ...fakeContext,
      df: {
        callActivity: jest.fn(),
        getInput: () => ({
          newProfile,
          oldProfile: {
            ...newProfile,
            isInboxEnabled: false
          }
        })
      }
    };
    const h = handler(c);
    expect(h.next()).toEqual({
      done: false,
      value: undefined
    });
    expect(c.df.callActivity).toHaveBeenCalledTimes(1);
    expect(c.df.callActivity).toHaveBeenCalledWith("WelcomeMessagesActivity", {
      profile: newProfile
    });
    expect(h.next()).toEqual({
      done: true,
      value: []
    });
  });
});
