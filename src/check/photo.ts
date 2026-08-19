import "server-only";

import { z } from "zod";

import { fetchImage, look } from "@/ai/vision";

import type { Problem } from "./content";

/**
 * Looking at the photograph before it becomes somebody's hero image.
 *
 * This is the one thing on the page that no amount of measuring can judge.
 * Everything else — the copy, the layout, the colours — we wrote or we can
 * count. The photograph came off a map listing, and what is behind that
 * thumbnail is genuinely unknown: it is as likely to be a phone snap of a
 * printed menu, a logo on white, a shot of the car park, or the inside of
 * somebody's van as it is to be the shopfront.
 *
 * Two templates give it the full height of the screen with the business name
 * over the top. A photograph of a car park at that size is worse than no
 * photograph — and "no photograph" is a layout all four templates already
 * handle, because it is the common case. So the only question asked here is
 * whether keeping it beats dropping it, and the default when anything goes
 * wrong is to keep it, since a merely dull hero is a smaller failure than a
 * build that stopped.
 *
 * Note what this is not: it is not a screenshot of the finished page. Checking
 * the ingredient rather than the dish needs no browser, costs one image
 * instead of a rendering engine, and catches the only defect that a rendered
 * page would have shown — because everything else in that render is ours.
 */

/**
 * Tolerant on purpose.
 *
 * A model asked for an optional field answers `"reason": null` about as often
 * as it omits the key, and `.optional()` rejects the first of those. Being
 * strict here does not buy a better answer — it throws away a correct verdict
 * over a spelling of "nothing", and the fallback for a thrown verdict is
 * keeping a photograph that was just judged unusable.
 */
const text = (max: number) => z.string().max(max).nullish();

/** null and "" both mean the model had nothing to say. */
const said = (value: string | null | undefined) => value?.trim() || undefined;

const Verdict = z.object({
  usable: z.boolean(),
  /** What it actually is, in a few words. For the log, and for the pitch. */
  subject: text(200),
  /** Only when unusable. */
  reason: text(300),
});

const SYSTEM = `You judge whether a photograph can be used as the full-screen header image of a small business's website.

It will be shown very large, with the business name in white over the top of it, darkened slightly.

Answer usable: false if the image is any of these:
- a logo, a wordmark, or artwork on a plain background
- a screenshot of anything: a website, an app, a social media post, a map
- a photograph of a printed menu, a price list, a poster, a flyer or a sign filling the frame
- mostly text
- a headshot or a selfie of one person looking at the camera
- an empty car park, a blank wall, a road, or an unrelated stock landscape
- so dark, so blurry or so low-resolution that it would look broken at full width
- a picture of a document, a receipt, a business card or a certificate

Answer usable: true if it shows the actual place, the work, the food, the products, the interior, the shopfront, or people at work. Ordinary phone-camera quality is fine — the bar is "would a reasonable owner be happy to see this at the top of their website", not "is this a good photograph".

Be strict. There is a clean fallback layout when there is no image, so a doubtful photograph should be rejected.

Return JSON: { "usable": boolean, "subject": "what it shows, in a few words", "reason": "why not, if unusable" }`;

export interface PhotoCheck {
  /** Whether the photo should be kept. True whenever we could not tell. */
  keep: boolean;
  subject?: string;
  problem?: Problem;
  /** Set when the check could not run at all — not a judgement on the photo. */
  skipped?: string;
}

export const checkPhoto = async (url: string | undefined): Promise<PhotoCheck> => {
  if (!url) return { keep: false, skipped: "no photo" };

  const image = await fetchImage(url);

  // A thumbnail that has stopped resolving is the ordinary end of a Google
  // photo's life. Dropping it is right; it would not have loaded for a visitor
  // either.
  if (!image) return { keep: false, skipped: "photo did not load" };

  try {
    const verdict = await look(Verdict, {
      system: SYSTEM,
      question: "Can this be the header image of this business's website?",
      image,
    });

    const subject = said(verdict.subject);

    if (verdict.usable) return { keep: true, subject };

    return {
      keep: false,
      subject,
      problem: {
        field: "photo",
        severity: "drop",
        message: said(verdict.reason) ?? `not usable as a hero: ${subject ?? "unclear"}`,
      },
    };
  } catch (cause) {
    // Out of quota, or the only provider that can see is having a bad minute.
    // Keeping it is the safe way to be wrong: the fallback layout is fine, but
    // so is a photograph nobody vetted, and neither justifies failing a build.
    return { keep: true, skipped: `could not look: ${String(cause).slice(0, 120)}` };
  }
};
