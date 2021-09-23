/**
 * Util function that takes a generator and executes each step until is done.
 * It is meant to be a test utility
 *
 * @param gen a generator function
 * @returns the last value yielded by the generator
 */
export const consumeGenerator = <TReturn = unknown>(
  gen: Generator<unknown, TReturn, unknown>
): TReturn => {
  // eslint-disable-next-line functional/no-let
  let prevValue: unknown;
            // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = gen.next(prevValue);
    if (done) {
      return value as TReturn;
    }
    prevValue = value;
  }
};
