import { Tuple2 } from "italia-ts-commons/lib/tuples";

import { BlockedInboxOrChannelEnum } from "io-functions-commons/dist/generated/definitions/BlockedInboxOrChannel";

import { diffBlockedServices } from "../profiles";

describe("diffBlockedServices", () => {
  const service1 = "service1";

  it("should return an added service when has been just blocked", () => {
    const oldPrefs = {
      [service1]: new Set()
    };

    const newPrefs = {
      [service1]: new Set([BlockedInboxOrChannelEnum.INBOX])
    };

    const res = diffBlockedServices(oldPrefs, newPrefs);
    expect(res).toEqual(Tuple2([service1], []));
  });

  it("should return nothing when the service is still blocked", () => {
    const oldPrefs = {
      [service1]: new Set([BlockedInboxOrChannelEnum.INBOX])
    };

    const newPrefs = {
      [service1]: new Set([BlockedInboxOrChannelEnum.INBOX])
    };

    const res = diffBlockedServices(oldPrefs, newPrefs);
    expect(res).toEqual(Tuple2([], []));
  });

  it("should return a removed service when has been just unblocked", () => {
    const oldPrefs = {
      [service1]: new Set([BlockedInboxOrChannelEnum.INBOX])
    };

    const newPrefs = {
      [service1]: new Set()
    };

    const res = diffBlockedServices(oldPrefs, newPrefs);
    expect(res).toEqual(Tuple2([], [service1]));
  });

  it("should ignore non-inbox channels", () => {
    expect(
      diffBlockedServices(
        {
          [service1]: new Set([
            BlockedInboxOrChannelEnum.INBOX,
            BlockedInboxOrChannelEnum.EMAIL
          ])
        },
        {
          [service1]: new Set([BlockedInboxOrChannelEnum.INBOX])
        }
      )
    ).toEqual(Tuple2([], []));
    expect(
      diffBlockedServices(
        {
          [service1]: new Set([BlockedInboxOrChannelEnum.INBOX])
        },
        {
          [service1]: new Set([
            BlockedInboxOrChannelEnum.INBOX,
            BlockedInboxOrChannelEnum.EMAIL
          ])
        }
      )
    ).toEqual(Tuple2([], []));
  });
});
