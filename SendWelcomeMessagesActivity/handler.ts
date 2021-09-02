import { AzureFunction, Context } from "@azure/functions";

import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";

import { NewMessage } from "@pagopa/io-functions-commons/dist/generated/definitions/NewMessage";
import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { toString } from "../utils/conversions";
import {
  cashbackContent,
  howToContent,
  welcomeMessageContent
} from "./welcome_messages";

function throwInvalidMessageError(errs: t.Errors): never {
  throw new Error(
    "Invalid MessageContent for welcome message: " + readableReport(errs)
  );
}

export const WelcomeMessageKind = t.keyof({
  CASHBACK: null,
  HOWTO: null,
  WELCOME: null
});
export type WelcomeMessageKind = t.TypeOf<typeof WelcomeMessageKind>;

type WelcomeMessages = Record<
  WelcomeMessageKind,
  (p: RetrievedProfile) => NewMessage
>;

// TODO: switch text based on user's preferred_language
const welcomeMessages: WelcomeMessages = {
  WELCOME: (_: RetrievedProfile) =>
    pipe(
      NewMessage.decode({
        content: welcomeMessageContent
      }),
      E.getOrElse(throwInvalidMessageError)
    ),
  // tslint:disable-next-line: object-literal-sort-keys
  HOWTO: (_: RetrievedProfile) =>
    pipe(
      NewMessage.decode({
        content: howToContent
      }),
      E.getOrElse(throwInvalidMessageError)
    ),
  CASHBACK: (_: RetrievedProfile) =>
    pipe(
      NewMessage.decode({
        content: cashbackContent
      }),
      E.getOrElse(throwInvalidMessageError)
    )
};

/**
 * Send a single welcome message using the
 * Digital Citizenship Notification API (REST).
 */
async function sendMessage(
  profile: RetrievedProfile,
  apiUrl: string,
  apiKey: string,
  newMessage: NewMessage,
  timeoutFetch: typeof fetch
): Promise<number> {
  const response = await timeoutFetch(
    `${apiUrl}/api/v1/messages/${profile.fiscalCode}`,
    {
      body: JSON.stringify(newMessage),
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": apiKey
      },
      method: "POST"
    }
  );
  return response.status;
}

// Activity result
const ActivityResultSuccess = t.interface({
  kind: t.literal("SUCCESS")
});

type ActivityResultSuccess = t.TypeOf<typeof ActivityResultSuccess>;

const ActivityResultFailure = t.interface({
  kind: t.literal("FAILURE"),
  reason: t.string
});

type ActivityResultFailure = t.TypeOf<typeof ActivityResultFailure>;

export const ActivityResult = t.taggedUnion("kind", [
  ActivityResultSuccess,
  ActivityResultFailure
]);
export type ActivityResult = t.TypeOf<typeof ActivityResult>;

export const ActivityInput = t.interface({
  messageKind: WelcomeMessageKind,
  profile: RetrievedProfile
});
export type ActivityInput = t.TypeOf<typeof ActivityInput>;

export const getActivityFunction = (
  publicApiUrl: NonEmptyString,
  publicApiKey: NonEmptyString,
  timeoutFetch: typeof fetch
): AzureFunction => async (
  context: Context,
  input: ActivityInput
): Promise<ActivityResult> => {
  const failure = (reason: string) => {
    context.log.error(reason);
    return ActivityResultFailure.encode({
      kind: "FAILURE",
      reason
    });
  };

  const success = () =>
    ActivityResultSuccess.encode({
      kind: "SUCCESS"
    });

  return pipe(
    ActivityInput.decode(input),
    E.fold(
      async errs =>
        failure(
          `SendWelcomeMessagesActivity|Cannot decode input profile|ERROR=${readableReport(
            errs
          )}|INPUT=${JSON.stringify(input.profile)}`
        ),
      async ({ profile, messageKind }) => {
        const logPrefix = `SendWelcomeMessagesActivity|PROFILE=${profile.fiscalCode}|VERSION=${profile.version}`;
        context.log.verbose(`${logPrefix}|Sending welcome message`);

        try {
          const status = await sendMessage(
            profile,
            publicApiUrl,
            publicApiKey,
            welcomeMessages[messageKind](profile),
            timeoutFetch
          );
          if (status !== 201) {
            if (status >= 500) {
              throw new Error(`${status}`);
            } else {
              return failure(`${logPrefix}|HTTP_ERROR=${status}`);
            }
          }
        } catch (e) {
          context.log.error(
            `${logPrefix}|ERROR=${toString(e)}|ID=${profile.fiscalCode.substr(
              0,
              5
            )}`
          );
          // throws in case of error or timeout so
          // the orchestrator can schedule a retry
          throw e;
        }

        return success();
      }
    )
  );
};

export default getActivityFunction;
