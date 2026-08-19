import { z } from "zod";

/**
 * The only shape a written pitch may come back in.
 *
 * Both the first draft and any rewrite validate against this, for the same
 * reason the brief's does: a correction allowed to return a wider shape can
 * reintroduce the very thing it was called to remove.
 *
 * The subject rules are enforced here rather than only asked for because they
 * are deliverability, not taste. A subject beginning "Re:" on a message that
 * replies to nothing is one of the oldest spam signals there is, and a
 * filter that learns it learns it about the sending address.
 *
 * Shouting is deliberately NOT checked here, although it is the obvious place
 * for it. This file does not know the business's name, and a great many of
 * them are acronyms — BFND Food Truck, MUMDA, JCA. A capitals rule that does
 * not know which capitals belong to the recipient rejects every one of them,
 * which is what it did on the first run of scripts/pitch-check.ts. It lives in
 * ./check instead, where the name can be taken out first.
 */

const SUBJECT_MAX = 60;

export const PitchDraftSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(8)
    .max(SUBJECT_MAX)
    .refine((s) => !/^(re|fwd?)\s*:/i.test(s), {
      message: "subject must not start with Re: or Fwd: — this replies to nothing",
    })
    .refine((s) => !/[\p{Extended_Pictographic}]/u.test(s), {
      message: "subject must not contain emoji",
    })
    .refine((s) => !s.includes("!"), {
      message: "subject must not use an exclamation mark",
    }),
  // No hard maximum here beyond a sane ceiling: word count is what actually
  // matters and it is checked in ./check, where a failure can say how far
  // over it is rather than just refusing.
  body: z.string().trim().min(80).max(1600),
});

export type PitchDraft = z.infer<typeof PitchDraftSchema>;
