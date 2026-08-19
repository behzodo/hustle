import "server-only";

import type { z } from "zod";

import { geminiKey, ProviderError } from "./providers";

/**
 * Looking at a picture.
 *
 * Gemini only, and not because it was preferred. It is the sole provider in
 * this stack whose free tier will accept an image at all — the other two are
 * text endpoints on the tiers we are on — so there is no fallback here and a
 * caller has to be able to carry on without an answer.
 *
 * Which is the right shape for what this is used for anyway. The check it
 * performs is on an ingredient rather than on the product: if it cannot run,
 * the site is still built and still published, it simply keeps a photograph
 * that might have been better dropped.
 */

/**
 * Deliberately not the model the text path uses.
 *
 * The free allowance is twenty requests a day *per model*, so pointing both at
 * gemini-3.6-flash means the copy for twenty sites uses up the eyes as well.
 * A separate model is a separate twenty, and the lite tier is the right one to
 * spend on this anyway: judging whether a photograph is a car park is not a
 * job that needs the larger model.
 */
const MODEL = "gemini-3.1-flash-lite";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** How long to wait for an image before deciding it is not worth having. */
const FETCH_TIMEOUT_MS = 8000;

/** Past this the image is downscaled by the API anyway and we paid to send it. */
const MAX_BYTES = 4 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export interface Seen {
  mime: string;
  base64: string;
  bytes: number;
}

/**
 * Fetches an image so it can be shown to the model.
 *
 * Returns null rather than throwing on everything ordinary. These URLs come off
 * a scraped map listing, they carry a token, and they expire — a photo that has
 * stopped resolving is the normal end of a Google thumbnail's life and not a
 * reason to fail a build.
 */
export const fetchImage = async (url: string): Promise<Seen | null> => {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!IMAGE_TYPES.has(mime)) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;

    return { mime, base64: buffer.toString("base64"), bytes: buffer.length };
  } catch {
    return null;
  }
};

export interface LookOptions {
  system: string;
  question: string;
  image: Seen;
  maxTokens?: number;
  thinking?: "low" | "high";
}

/**
 * How long to wait out a rate limit, and how many times.
 *
 * An image is several hundred times the size of the prompt beside it, so the
 * per-minute allowance goes on pictures long before it goes on words: five
 * back to back is enough to be refused where fifty text calls were not. Since
 * the alternative to waiting is publishing a photograph nobody checked, a
 * short pause is worth having — but only a short one, because this sits inside
 * a build somebody may be watching.
 */
const RETRY_WAITS_MS = [4000, 12000];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Shows the model an image and asks for JSON back. */
export const look = async <T>(
  schema: z.ZodType<T>,
  options: LookOptions,
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_WAITS_MS.length; attempt++) {
    try {
      return await lookOnce(schema, options);
    } catch (cause) {
      lastError = cause;

      const rateLimited =
        cause instanceof ProviderError && /answered 429/.test(cause.message);

      if (!rateLimited || attempt === RETRY_WAITS_MS.length) throw cause;

      await pause(RETRY_WAITS_MS[attempt]);
    }
  }

  throw lastError;
};

const lookOnce = async <T>(
  schema: z.ZodType<T>,
  { system, question, image, maxTokens = 1200, thinking = "low" }: LookOptions,
): Promise<T> => {
  const key = geminiKey();

  if (!key) {
    throw new ProviderError("Gemini is not configured; nothing here can see.", "gemini", false);
  }

  const response = await fetch(`${BASE}/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: question },
            { inline_data: { mime_type: image.mime, data: image.base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingLevel: thinking },
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    throw new ProviderError(
      `gemini answered ${response.status}: ${(await response.text()).slice(0, 200)}`,
      "gemini",
      response.status === 429 || response.status >= 500,
    );
  }

  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new ProviderError("gemini looked and said nothing.", "gemini", true);
  }

  const open = text.indexOf("{");
  const close = text.lastIndexOf("}");

  return schema.parse(
    JSON.parse(open !== -1 && close > open ? text.slice(open, close + 1) : text),
  );
};
