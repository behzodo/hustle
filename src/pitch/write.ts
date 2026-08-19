import "server-only";

import { z } from "zod";

import { askJson, type ProviderName } from "@/ai";

import { checkPitch, type PitchProblem } from "./check";
import {
  pitchTone,
  priceNote,
  PITCH_FORMAT,
  PITCH_SYSTEM,
  SMS_FORMAT,
  SMS_SYSTEM,
} from "./prompt";
import { PitchDraftSchema, SmsDraftSchema, type PitchDraft } from "./schema";

/**
 * Writing one message, and refusing to accept a bad one.
 *
 * Same shape as src/compose.ts on the build side — draft, check, correct — and
 * for the same reason: the model is asked to obey a list of rules and mostly
 * does, and "mostly" over four hundred businesses is a number of messages that
 * lie to somebody. The check is what turns a request into a guarantee.
 *
 * The difference from the build side is what happens when the correction also
 * fails. A page with a bad line can be published and fixed; a message cannot be
 * unsent. So a pitch that still has a `bad` problem after two rewrites is
 * handed back marked `blocked`, and the queue leaves it as a draft for a
 * person to read rather than sending it anyway.
 */

/**
 * How many times to ask again.
 *
 * Two, measured the same way the site repairs were: a first rewrite fixes
 * almost everything a check catches, a second catches the stubborn case, and a
 * third mostly produces a differently-worded version of the same fault while
 * spending another minute of a rate limit somebody else is queuing for.
 */
const MAX_REWRITES = 2;

/**
 * Which way this one goes out.
 *
 * Only two of the four can start a conversation. Instagram and Facebook are in
 * the type because a thread can arrive on one and be answered there, never
 * because a pitch can be sent on one — Meta refuses a message to anybody who
 * has not written in first. See CAN_START in src/lib/nango.ts.
 */
export type PitchChannel = "email" | "sms" | "instagram" | "facebook";

export interface PitchFacts {
  /** The business, as it is spelled on its listing. */
  name: string;
  trade: string;
  town?: string;
  categories?: string[];
  /** Their own site, freshly built and already live. The point of the message. */
  siteUrl: string;
}

export interface Sender {
  /** Signs it. Required — an unsigned cold message is an anonymous one. */
  tradingName: string;
  /** Where they work, for the line under the name. */
  city?: string;
  /** Tone slug from the profile. */
  tone?: string;
  /** Price band slug. Absent means the message may not mention money at all. */
  priceBand?: string;
}

export interface ComposedPitch {
  subject: string;
  /** The whole message, sign-off included, ready to send. */
  body: string;
  problems: PitchProblem[];
  /** True when a `bad` problem survived every rewrite. Do not send. */
  blocked: boolean;
  rewrites: number;
  provider: ProviderName;
  tokens: number;
}

/**
 * The sign-off, written here rather than by the model.
 *
 * Three things have to be in it and none may be paraphrased: who sent it,
 * where they are, and how to make it stop. A model asked for a sign-off will
 * sometimes give a warm one, sometimes a witty one, and occasionally somebody
 * else's name.
 *
 * The last line is the opt-out. A cold commercial message needs a working way
 * to refuse more of them — that is the law in most places this will be sent,
 * and it is also just the decent version of doing this.
 *
 * A text gets a compressed version of the same three facts, because it is read
 * on a lock screen and billed by the segment. "Reply STOP" rather than a
 * sentence: STOP is the keyword every US carrier honours at the network level,
 * so it works whether or not our own code remembers to act on it. Anything
 * else only works if we do.
 *
 * What is deliberately absent is a postal address, which CAN-SPAM also
 * requires and the profile does not hold. See the note in src/pitch/index.ts.
 */
const signOff = (sender: Sender, channel: PitchChannel) => {
  if (channel === "sms") {
    return `\n— ${sender.tradingName}. Reply STOP to opt out.`;
  }

  return [
    "",
    "—",
    sender.tradingName,
    sender.city ? `Websites for local businesses, ${sender.city}` : null,
    "",
    'If you would rather I did not write again, reply "no thanks" and I will not.',
  ]
    .filter((line) => line !== null)
    .join("\n");
};

/** Everything the model is allowed to know, written out plainly. */
const describe = (facts: PitchFacts, sender: Sender) => {
  const others = (facts.categories ?? []).filter((c) => c && c !== facts.trade);
  const price = priceNote(sender.priceBand);

  const lines = [
    `Business name: ${facts.name}`,
    `What they do: ${facts.trade}`,
    others.length ? `Also listed as: ${others.join(", ")}` : null,
    facts.town ? `Where: ${facts.town}` : null,
    "",
    `The site you built for them, already live: ${facts.siteUrl}`,
    "",
    `Who is writing: ${sender.tradingName}`,
    sender.city ? `Based in: ${sender.city}` : null,
    price
      ? `What they charge, if the message mentions money at all: ${price}`
      : "Do not mention money. No price, no range, no number of any kind.",
    "",
    `Voice: ${pitchTone(sender.tone)}`,
  ];

  return lines.filter((line) => line !== null).join("\n");
};

export const writePitch = async (
  facts: PitchFacts,
  sender: Sender,
  options: { order?: ProviderName[]; channel?: PitchChannel } = {},
): Promise<ComposedPitch> => {
  const channel = options.channel ?? "email";
  const texting = channel === "sms";

  const user = [
    describe(facts, sender),
    "",
    texting ? SMS_FORMAT : PITCH_FORMAT,
    "",
    "Nothing above this line may be added to. If a fact is not listed, it is not known, and you must not write a sentence that depends on it.",
  ].join("\n");

  // A text has no subject line, so one is supplied rather than asked for.
  // Nothing on a phone ever reads it; the column exists because the inbox
  // draws one row template for every channel, and a blank line in it looks
  // like a fault rather than like a property of SMS.
  //
  // Typed as one thing rather than a union of two: a transformed schema and
  // a plain object schema have different Zod types, and left to infer, the
  // generic on `askJson` resolves to whichever branch it sees first.
  const shape: z.ZodType<PitchDraft, z.ZodTypeDef, unknown> = texting
    ? SmsDraftSchema.transform((value) => ({
        subject: `Website for ${facts.name}`.slice(0, 60),
        body: value.body,
      }))
    : PitchDraftSchema;

  let complaint = "";
  let rewrites = 0;
  let tokens = 0;
  let last: ComposedPitch | null = null;

  for (let attempt = 0; attempt <= MAX_REWRITES; attempt++) {
    // A schema failure is a rewrite, not a crash.
    //
    // `askJson` gives up after its own two tries and throws, and on the first
    // run over a real patch that threw away a business that was otherwise
    // fine: the model answered with prose instead of JSON, once, for one shop.
    // Caught here so the outer loop asks again with a complaint attached,
    // which is exactly what it already does for every other kind of bad answer.
    let draft: Awaited<ReturnType<typeof askJson<PitchDraft>>>;

    try {
      draft = await askJson(shape, {
        system: texting ? SMS_SYSTEM : PITCH_SYSTEM,
        user: complaint
          ? `${user}\n\nYour last attempt was rejected because it ${complaint}. Write it again without that.`
          : user,
        maxTokens: 2000,
        // Obedience, not reasoning — the same call the brief makes, for the
        // same reason. The rules are explicit and the output is two short
        // fields.
        thinking: "low",
        // Higher than the brief's, because four hundred businesses in one town
        // must not all receive the same paragraph. A recognisably templated
        // message is one that gets forwarded between them.
        temperature: 0.9,
        order: options.order,
      });
    } catch (cause) {
      if (attempt === MAX_REWRITES) throw cause;

      rewrites += 1;
      complaint = "was not valid JSON in the shape that was asked for";
      continue;
    }

    tokens += draft.tokens;

    const problems = checkPitch({
      subject: draft.value.subject,
      body: draft.value.body,
      business: facts.name,
      siteUrl: facts.siteUrl,
      pricing: Boolean(priceNote(sender.priceBand)),
      channel,
    });

    const bad = problems.filter((p) => p.severity === "bad");

    last = {
      subject: draft.value.subject,
      // The sign-off is appended after the check, not before. Every rule the
      // checker enforces is about what the model wrote, and running it over
      // our own sign-off would have it object to our own opt-out line.
      body: `${draft.value.body.trim()}\n${signOff(sender, channel)}`,
      problems,
      blocked: bad.length > 0,
      rewrites,
      provider: draft.provider,
      tokens,
    };

    if (bad.length === 0) return last;

    rewrites += 1;
    complaint = bad.map((p) => p.message).join(", and ");
  }

  // Three attempts, still lying. Handed back rather than thrown, because the
  // draft and the reason it was refused are both worth putting on the screen —
  // and because one impossible business must not stop the queue behind it.
  return last!;
};
