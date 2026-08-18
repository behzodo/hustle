import "server-only";

/**
 * The free tiers, and what each is actually good for.
 *
 * Three accounts rather than one, because none of them is generous enough on
 * its own and their limits bind in completely different places. Measured
 * against these keys rather than taken from anybody's marketing page:
 *
 *   Cerebras  2,400 requests and 1,000,000 tokens a day, 30k of those tokens
 *             in any one minute but only 5 requests in it. Far the largest
 *             allowance here, and the one the fast lane runs on.
 *   Groq      8k tokens a minute against 30 requests. The opposite shape — many
 *             small calls rather than a few large ones — which is what an agent
 *             loop is, so it is what the slow lane uses.
 *   Gemini    twenty requests per day per model. Twenty. It is last for text
 *             and would not be here at all except that it is the only one on
 *             these tiers that can be shown a picture, which is what the photo
 *             check needs. See vision.ts, which deliberately spends a
 *             *different* model's twenty so the two do not compete.
 *
 * The order below was originally the reverse of this, on the strength of
 * published figures that turned out to describe a tier this account is not on.
 * If a limit here looks wrong, measure it before trusting it: every number
 * above came off a 429.
 *
 * They are tried in order and a provider that is out of quota hands over
 * rather than failing the call. Which is the whole point of holding three.
 */

export type ProviderName = "gemini" | "cerebras" | "groq";

export interface Ask {
  system: string;
  user: string;
  /** Ceiling on the reply. Reasoning models spend this before writing. */
  maxTokens?: number;
  temperature?: number;
  /** Ask the provider to answer with JSON and nothing else. */
  json?: boolean;
  /**
   * How much the model should think before it writes.
   *
   * Gemini 3.x reasons by default, and for filling a template with sentences
   * that costs about three times the wall-clock and three times the tokens for
   * no visible gain: measured on one brief, 7.3s and 835 tokens against 2.6s
   * and 244. Left at "high" for anything where the answer is actually hard —
   * reading a screenshot, repairing a build.
   *
   * Ignored by the OpenAI-shaped providers, whose reasoning models decide for
   * themselves and charge for it either way.
   */
  thinking?: "low" | "high";
}

export interface Answer {
  text: string;
  provider: ProviderName;
  model: string;
  tokens: number;
}

/** Thrown when a provider will not answer. `retryable` says whether to move on. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderName,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

interface Provider {
  name: ProviderName;
  model: string;
  configured: () => boolean;
  ask: (ask: Ask) => Promise<Answer>;
}

/**
 * Whether a failure is worth handing to the next provider.
 *
 * A rate limit or a five-hundred is somebody else's bad minute and the next
 * bucket will very likely answer. A four-hundred is this request being wrong,
 * and asking a different provider the same malformed question wastes two
 * quotas instead of one.
 */
const movesOn = (status: number) => status === 429 || status >= 500;

/* -------------------------------------------------------------------------- */

/**
 * Groq and Cerebras, which both speak OpenAI's shape.
 *
 * `max_completion_tokens` rather than `max_tokens`: both now reject the old
 * name on their reasoning models, and gpt-oss-120b — which is what Cerebras
 * offers on this tier — is one. That model also returns its thinking in a
 * separate field and its answer in `content`, so a ceiling set too low comes
 * back as a successful response with an empty string in it.
 */
const openAiShaped = (
  name: ProviderName,
  base: string,
  model: string,
  key: () => string | undefined,
): Provider => ({
  name,
  model,
  configured: () => Boolean(key()),

  async ask({ system, user, maxTokens = 4000, temperature = 0.7, json }: Ask) {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_completion_tokens: maxTokens,
        temperature,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      throw new ProviderError(
        `${name} answered ${response.status}: ${(await response.text()).slice(0, 200)}`,
        name,
        movesOn(response.status),
      );
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };

    const text = body.choices?.[0]?.message?.content ?? "";

    // Empty but successful is the reasoning-model failure above. Retryable,
    // because the next provider is not necessarily one.
    if (!text.trim()) {
      throw new ProviderError(`${name} returned an empty completion.`, name, true);
    }

    return { text, provider: name, model, tokens: body.usage?.total_tokens ?? 0 };
  },
});

export const groq = () =>
  openAiShaped(
    "groq",
    "https://api.groq.com/openai/v1",
    "openai/gpt-oss-120b",
    () => process.env.GROQ_API_KEY,
  );

export const cerebras = () =>
  openAiShaped(
    "cerebras",
    "https://api.cerebras.ai/v1",
    "gpt-oss-120b",
    () => process.env.CEREBRAS_API_KEY,
  );

/* -------------------------------------------------------------------------- */

/**
 * Gemini, which does not.
 *
 * Worth the separate adapter for two reasons: the free allowance is the
 * largest of the three, and it is the only one here that can be shown a
 * screenshot — which is what the check step needs and what neither of the
 * others can do at any price on a free tier.
 *
 * Pinned to 3.6-flash. The 2.5 models are closed to keys issued from now on
 * and answer 404, and 3.7 was returning 503 under load when this was written;
 * a model that is occasionally unavailable is a worse default than one that is
 * slightly older.
 */
const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const geminiKey = () => process.env.GEMINI_API_KEY;

export const gemini = (): Provider => ({
  name: "gemini",
  model: GEMINI_MODEL,
  configured: () => Boolean(geminiKey()),

  async ask({ system, user, maxTokens = 4000, temperature = 0.7, json, thinking }: Ask) {
    const response = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": geminiKey() ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          // `thinkingBudget: 0` is the 2.5-era spelling and is rejected
          // outright by 3.x with a 400. `thinkingLevel` is the current one.
          ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {}),
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });

    if (!response.ok) {
      throw new ProviderError(
        `gemini answered ${response.status}: ${(await response.text()).slice(0, 200)}`,
        "gemini",
        movesOn(response.status),
      );
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { totalTokenCount?: number };
    };

    const text = (body.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("");

    if (!text.trim()) {
      throw new ProviderError("gemini returned an empty completion.", "gemini", true);
    }

    return {
      text,
      provider: "gemini" as const,
      model: GEMINI_MODEL,
      tokens: body.usageMetadata?.totalTokenCount ?? 0,
    };
  },
});

/* -------------------------------------------------------------------------- */

/**
 * Preference order for one large call per job — which is the fast lane.
 *
 * Cerebras first on daily allowance: it is a hundred times Gemini's. Gemini
 * last rather than absent because twenty calls is still twenty calls, and the
 * day the other two are both having a bad minute it is what finishes the run.
 */
export const BULK_ORDER: ProviderName[] = ["cerebras", "groq", "gemini"];

export const providers = (): Record<ProviderName, Provider> => ({
  gemini: gemini(),
  cerebras: cerebras(),
  groq: groq(),
});
