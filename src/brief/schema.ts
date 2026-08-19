import { z } from "zod";

/**
 * What the model is allowed to hand back, for a first draft and a correction
 * alike.
 *
 * Kept in its own file because both `writeBrief` and `repairCopy` validate
 * against it, and a repair that was allowed to return a shape the first pass
 * could not is a repair that can widen the very field it was called to
 * shorten.
 *
 * The limits are not tidiness. `headline` is set with `clamp(2.5rem, 8vw,
 * 5.5rem)` in three of the four templates, so a sentence there is a hero three
 * lines deep rather than a page that reads badly — length is a layout
 * constraint here, and it is enforced where layout cannot recover from it.
 */

const Service = z.object({
  name: z.string().trim().min(2).max(40),
  blurb: z.string().trim().max(90).optional(),
});

/**
 * `reviews` is deliberately absent.
 *
 * The templates render testimonials and the sweep stores a review *count*,
 * never review *text* — so the only way a quote could reach a page is by being
 * invented, attributed to a customer who did not say it, on a site published
 * at a real business's name. A field that cannot be filled honestly is better
 * off not existing.
 */
export const BriefCopySchema = z.object({
  headline: z.string().trim().min(3).max(70),
  subhead: z.string().trim().max(180).optional(),
  about: z.string().trim().max(450).optional(),
  services: z.array(Service).min(1).max(6),
  // No digits. Asked for "a verb", a model reliably answers "Call (305) 555
  // 0182" — which every template then prints directly under the phone number
  // it already sets at eight times body size. Enforced here rather than only
  // asked for, because the prompt asks and the schema is what holds.
  ctaLabel: z
    .string()
    .trim()
    .max(28)
    .refine((label) => !/\d/.test(label), {
      message: "ctaLabel must not contain a phone number or any digits",
    })
    .optional(),
  closing: z.string().trim().max(90).optional(),
});

export type BriefCopy = z.infer<typeof BriefCopySchema>;
