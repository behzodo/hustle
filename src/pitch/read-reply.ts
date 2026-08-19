import "server-only";

import { askJson } from "@/ai";
import { z } from "zod";

/**
 * Working out what a reply actually said.
 *
 * The diagram this was built from has three branches — they like it, they do
 * not, or they want something changed — and all three are real. What it does
 * not have are the two that arrive first and most often, and getting either of
 * them wrong is worse than getting the three right is good:
 *
 *   An out-of-office is not interest. "Thanks for your email, I am away until
 *   Monday" is warm, positive, addressed to us, and means nothing at all. Read
 *   as keen it produces an invoice sent to somebody on holiday.
 *
 *   "Take me off your list" is not a rejection to be followed up. It is an
 *   instruction, it is the one the opt-out line in every pitch promised to
 *   honour, and honouring it has to be mechanical rather than a judgement.
 *
 * So both are decided here in code, before a model sees the text, and only
 * what is left is classified.
 */

/**
 * Marks of a machine.
 *
 * Header-driven where possible: `auto-submitted` and `x-autoreply` are what a
 * well-behaved autoresponder sets and are worth more than any phrase. The
 * phrases catch the rest, and they are anchored near the start because "I will
 * be out of the office next week" halfway down a genuine reply is a person
 * telling us their diary, not a robot.
 */
const AUTOMATIC =
  /^(?:[\s\S]{0,200}?)\b(?:out\s+of\s+(?:the\s+)?office|automatic(?:ally)?\s+repl|auto[- ]?repl|away\s+(?:from\s+my\s+desk|until|on\s+annual\s+leave)|thank\s+you\s+for\s+(?:contacting|your\s+email)[^.]{0,40}\bwe\s+(?:will|aim\s+to)\s+(?:respond|reply|get\s+back)|this\s+is\s+an\s+automated)/i;

/** Undeliverable. The address is wrong and no follow-up will fix it. */
const BOUNCE =
  /\b(?:delivery\s+(?:has\s+)?failed|undeliverable|address\s+not\s+found|mailbox\s+(?:is\s+)?full|recipient\s+(?:address\s+)?rejected|550[\s-]?5\.\d)/i;

/**
 * Asked to stop.
 *
 * Matched generously on purpose. A false positive here costs one pitch that
 * was never going anywhere; a false negative means writing again to somebody
 * who asked us not to, having promised in writing that we would not.
 */
const STOP =
  /\b(?:unsubscribe|no\s+thanks?|not\s+interested|remove\s+me|take\s+me\s+off|do\s*n[o']?t\s+(?:contact|email|write)|stop\s+(?:emailing|contacting)|leave\s+me\s+alone|piss\s+off|fuck\s+off)\b/i;

export type Verdict =
  /** Wants it. Send the invoice. */
  | "keen"
  /** Wants the site changed before they commit. Back to the build lane. */
  | "changes"
  /** Asking something — price, who we are, how it works. Answer it. */
  | "question"
  /** Not interested, but has not asked us to stop. */
  | "cool"
  /** Asked not to be written to again. Honour it, permanently. */
  | "stop"
  /** A machine, not a person. Nothing has happened yet. */
  | "auto"
  /** The address does not work. */
  | "bounced";

const VerdictSchema = z.object({
  verdict: z.enum(["keen", "changes", "question", "cool"]),
  /** One line, in the reader's own words where possible. Shown on the card. */
  gist: z.string().trim().max(140),
  /**
   * What they want changed, when the verdict is `changes`.
   *
   * Fed straight into a rebuild, so it has to be a description of the site and
   * not a summary of the email: "wants the phone number bigger and a photo of
   * the shop front", never "customer requested changes".
   */
  wants: z.string().trim().max(300).optional(),
});

export interface Reading {
  verdict: Verdict;
  gist: string;
  wants?: string;
  /** False when it was decided by pattern rather than by a model. */
  asked: boolean;
}

const SYSTEM = `You read one reply from a local business owner to a cold email offering them a website that has already been built for them.

Decide which of four things it is:

- "keen": they want it, or want to talk about buying it. Includes "how much?", "yes", "call me", "send me the details".
- "changes": they like it enough to say what is wrong with it. Anything about the site itself — wrong hours, wrong services, an old photo, a name spelled wrong, wanting a page added.
- "question": they are asking something that is not about buying. Who are you, where did you get my address, is this real.
- "cool": they are not interested and have not asked to be left alone.

"how much is it" is keen, not question. Somebody asking the price is somebody considering it.
A reply that is both — "looks good but the phone number is wrong, how much?" — is "changes". The site has to be right before anything else happens.

Be literal. Do not read enthusiasm into politeness; a lot of people are polite while saying no.`;

/**
 * Reads one reply.
 *
 * The pattern checks run first and short-circuit, so an out-of-office costs
 * nothing and — more to the point — cannot be talked into meaning something
 * else by a model having a generous day.
 */
export const readReply = async (text: string): Promise<Reading> => {
  const trimmed = text.trim();

  if (!trimmed) {
    return { verdict: "auto", gist: "Empty reply", asked: false };
  }

  if (BOUNCE.test(trimmed)) {
    return { verdict: "bounced", gist: "The address does not accept mail", asked: false };
  }

  if (STOP.test(trimmed)) {
    return { verdict: "stop", gist: "Asked not to be contacted again", asked: false };
  }

  if (AUTOMATIC.test(trimmed)) {
    return { verdict: "auto", gist: "Automatic reply — nobody has read it yet", asked: false };
  }

  const { value } = await askJson(VerdictSchema, {
    system: SYSTEM,
    user: `The reply, in full:\n\n${trimmed.slice(0, 4000)}`,
    maxTokens: 1200,
    // The judgement here is short but it is a judgement — "looks good, but the
    // number's wrong" has to come out as `changes` rather than `keen`, and
    // that is the distinction the whole loop turns on.
    thinking: "low",
    // Low. This is a classification, and a classification that varies run to
    // run is one nobody can act on.
    temperature: 0.2,
  });

  return { ...value, asked: true };
};
