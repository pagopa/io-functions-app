import { createTracker as createTrackerReal } from "../utils/tracking";
const mockTracker = (name: string | symbol | number) =>
  new Proxy(
    {},
    {
      get: (_, k) => () =>
        console.log(`Tracing ${name.toString()}.${k.toString()}`)
    }
  );
export const createTracker: typeof createTrackerReal = (..._) =>
  new Proxy(
    {},
    {
      get(_, key) {
        return mockTracker(key);
      }
    }
  ) as ReturnType<typeof createTrackerReal>;
