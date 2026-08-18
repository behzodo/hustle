/**
 * Waiting out the model's rate limit instead of dying on it.
 *
 * Groq's free tier allows 8,000 tokens a minute. One turn of the code agent —
 * system prompt, the files it has written, the compiler errors it is fixing —
 * is roughly half of that, so a build does not fail because of a bug. It fails
 * because it asked for its third turn inside the same minute, and agent-kit
 * turns any non-200 into a thrown Error that ends the run.
 *
 * That is a throughput limit, not a wall, and this job is not one anybody
 * watches: Inngest runs it in the background and writes the result into Convex
 * when it is done. Waiting eleven seconds for a token bucket to refill costs
 * nothing a user can perceive. Falling over costs the whole build.
 *
 * So the transport waits. It is a wrapper around `fetch` because the adapter
 * has no hook to put this in — `openai()` takes a model, a key, a base URL and
 * default parameters, and issues its requests through the global. Narrowed to
 * the model host so nothing else in the process can be delayed by it, and
 * bounded so a genuinely exhausted account fails in a minute and a half rather
 * than holding a job open forever.
 */

/** Only requests to the model provider are ever retried. */
const MODEL_HOSTS = ["api.groq.com", "api.openai.com"];

/** Total time spent waiting on one request before giving up on it. */
const MAX_WAIT_MS = 90_000;

/** A limit that reports no hint of its own. */
const DEFAULT_WAIT_MS = 2_000;

/** No single wait is longer than this, however far off the reset is. */
const MAX_STEP_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Seconds, as "1.1475" or "12s", from whichever header carried it. */
const parseSeconds = (value: string | null) => {
  if (!value) return null;
  const seconds = Number.parseFloat(value.replace(/s$/, ""));
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
};

/**
 * How long to wait before asking again.
 *
 * `retry-after` is the standard answer and Groq does not always send it, so
 * the token bucket's own reset is read as a fallback — it is the number that
 * actually governs when the next request can succeed.
 */
const waitFor = (response: Response) => {
  const hinted =
    parseSeconds(response.headers.get("retry-after")) ??
    parseSeconds(response.headers.get("x-ratelimit-reset-tokens")) ??
    DEFAULT_WAIT_MS;

  // A hair over the hint: asking at the exact moment the bucket refills is a
  // race with whatever else is drawing on the same quota.
  return Math.min(hinted + 250, MAX_STEP_MS);
};

let installed = false;

/**
 * Wrap the global fetch, once.
 *
 * Idempotent because the Inngest function calls it on every run and wrapping a
 * wrapper on each one would build a chain that retries 2^n times.
 */
export const installModelRetry = () => {
  if (installed) return;
  installed = true;

  const original = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (!MODEL_HOSTS.some((host) => url.includes(host))) {
      return original(input, init);
    }

    let waited = 0;

    for (;;) {
      const response = await original(input, init);
      if (response.status !== 429) return response;

      const wait = waitFor(response);

      // Handed back unretried so the caller sees the provider's own message,
      // which names the limit and the plan that lifts it. A generic "rate
      // limited after 90 seconds" would be less useful than what it says.
      if (waited + wait > MAX_WAIT_MS) return response;

      await sleep(wait);
      waited += wait;
    }
  };
};
