import "server-only";

import type { z } from "zod";

import {
  BULK_ORDER,
  ProviderError,
  providers,
  type Answer,
  type Ask,
  type ProviderName,
} from "./providers";

export { ProviderError, type ProviderName } from "./providers";

/**
 * Asking a model something, across three accounts.
 *
 * The fallback is the feature. Every provider under here is a free tier, and a
 * free tier's failure mode is not an outage — it is a minute in which it will
 * not answer and the minute after in which it will. A job that stops for that
 * is a job that stops several times an hour, so a refusal moves to the next
 * bucket and the run carries on.
 */

export interface AskOptions extends Ask {
  /** Overrides the default preference order. */
  order?: ProviderName[];
}

/**
 * How long to wait when every provider is rate-limited, and how many times.
 *
 * A rate limit is not a failure, it is a queue. Cerebras allows five requests
 * a minute and Groq's eight thousand tokens a minute works out at about four
 * briefs — so a pool of workers exhausts all three buckets in seconds and then
 * asks again a moment later, which is fine, as long as somebody waits.
 *
 * Nobody did, at first: the first run of a real patch failed sixty-four of
 * seventy-three businesses, every one of them with a 429 that would have
 * cleared inside a minute. The pauses below are the width of the window those
 * limits are measured over.
 */
const RATE_LIMIT_WAITS_MS = [8000, 20000, 40000, 60000];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const ask = async (options: AskOptions): Promise<Answer> => {
  const shops = providers();
  const order = (options.order ?? BULK_ORDER).filter((name) => shops[name].configured());

  if (order.length === 0) {
    throw new Error(
      "No AI provider is configured. Set GEMINI_API_KEY, CEREBRAS_API_KEY or " +
        "GROQ_API_KEY in .env.",
    );
  }

  let failures: string[] = [];

  for (let round = 0; round <= RATE_LIMIT_WAITS_MS.length; round++) {
    failures = [];
    let waitHint = 0;
    let anyRateLimited = false;

    for (const name of order) {
      try {
        return await shops[name].ask(options);
      } catch (cause) {
        const error =
          cause instanceof ProviderError
            ? cause
            : new ProviderError(String(cause), name, true);

        failures.push(error.message);

        // A bad request is bad at every provider. Asking the other two the
        // same malformed question spends three quotas to learn one thing.
        if (!error.retryable) throw error;

        if (error.rateLimited) {
          anyRateLimited = true;
          waitHint = Math.max(waitHint, error.retryAfterMs ?? 0);
        }
      }
    }

    // Everything that refused refused for some other reason — an outage, a
    // model having a bad minute. Waiting does not help with those.
    if (!anyRateLimited || round === RATE_LIMIT_WAITS_MS.length) break;

    // Whichever is longer: what a provider actually asked for, or the backoff.
    // Capped, because a provider that asks for an hour is telling us about a
    // daily quota, and this call is not going to outlast it.
    await pause(Math.min(Math.max(waitHint, RATE_LIMIT_WAITS_MS[round]), 90_000));
  }

  throw new Error(`Every provider refused:\n${failures.join("\n")}`);
};

/**
 * Pulls the JSON out of a reply that was supposed to be only JSON.
 *
 * Every provider here is asked for a JSON mime type and most of them honour
 * it. Most is not all: a fenced code block, or a sentence of preamble before
 * the brace, are both common enough that failing the whole run over them would
 * be throwing away a good answer for a formatting habit.
 */
const carve = (text: string): string => {
  const trimmed = text.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  const open = trimmed.indexOf("{");
  const close = trimmed.lastIndexOf("}");

  return open !== -1 && close > open ? trimmed.slice(open, close + 1) : trimmed;
};

export interface JsonResult<T> {
  value: T;
  provider: ProviderName;
  model: string;
  tokens: number;
  /** How many attempts it took, including the one that worked. */
  attempts: number;
}

/**
 * Asks for JSON of a particular shape, and insists.
 *
 * The retry hands back what was wrong with the last answer rather than asking
 * the same question again, because a model that returned six services when it
 * was told four will do it again on an identical prompt — and being shown the
 * validator's complaint is usually enough. Two attempts: past that it is not a
 * near miss, and the caller has a better fallback than a third try.
 */
export const askJson = async <T>(
  // The input side is `unknown` rather than `T`, so a schema that transforms
  // on the way through is accepted as readily as a plain one. What the model
  // returns is untyped JSON either way; the only thing a caller cares about is
  // what comes out.
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  options: AskOptions,
  attempts = 2,
): Promise<JsonResult<T>> => {
  let complaint = "";

  // Groq refuses JSON mode outright unless the word "json" appears somewhere
  // in the messages: a 400 reading "'messages' must contain the word 'json'
  // in some form". Most prompts here happen to say "Return JSON" and pass by
  // luck. The reply classifier did not, so it worked on the first two
  // providers and died on the third — the worst kind of intermittent, since
  // the third is only reached when the first two are rate-limited. Added
  // once here rather than remembered in every prompt.
  const speaksJson = /json/i.test(`${options.system} ${options.user}`);
  const asked = speaksJson
    ? options.user
    : `${options.user}\n\nAnswer with JSON, and nothing else.`;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const answer = await ask({
      ...options,
      json: true,
      user: complaint
        ? `${asked}\n\nYour last answer was rejected: ${complaint}\nReturn corrected JSON, and nothing else.`
        : asked,
    });

    try {
      const parsed = schema.parse(JSON.parse(carve(answer.text)));

      return {
        value: parsed,
        provider: answer.provider,
        model: answer.model,
        tokens: answer.tokens,
        attempts: attempt,
      };
    } catch (cause) {
      complaint =
        cause instanceof SyntaxError
          ? "it was not valid JSON."
          : String(cause).replace(/\s+/g, " ").slice(0, 400);

      if (attempt === attempts) {
        throw new Error(`The model would not produce usable JSON: ${complaint}`);
      }
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new Error("The model would not produce usable JSON.");
};
