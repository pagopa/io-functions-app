import { Context } from "@azure/functions";

/**
 * Just an adapter to use output bindings on an Activity
 */
export default async (context: Context, input: unknown): Promise<void> => {
  // eslint-disable-next-line functional/immutable-data
  context.bindings.apievents =
    typeof input === "string" ? input : JSON.stringify(input);
};
