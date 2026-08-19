import "server-only";

import { askJson } from "@/ai";
import { z } from "zod";

import { checkPitch, type PitchProblem } from "./check";
import { pitchTone, priceNote } from "./prompt";
import type { PitchChannel, Sender } from "./write";
import type { Verdict } from "./read-reply";

/**
 * Answering a business that wrote back, in the time it takes to read it.
 *
 * The point of the whole lane. A local business owner who replies to a cold
 * message is at their most interested in the ninety seconds after they press
 * send, and every hour after that costs some of it. An answer in four seconds
 * is a different product from an answer tomorrow morning.
 *
 * What makes that safe rather than reckless is that the answer goes through
 * the same checker the pitch did. An automatic reply can invent a price, agree
 * to work nobody agreed to, or apologise for a fault that does not exist — and
 * unlike a bad pitch, a bad reply is sent to somebody who is already paying
 * attention. So: same rules, same rewrites, and a reply that still fails is
 * not sent at all. Slow is recoverable; wrong is not.
 *
 * Three verdicts are never answered by a machine and the decision is made
 * before a model is asked. "Stop" is honoured in silence, because arguing with
 * an opt-out is the one thing the sign-off promised not to do. A bounce has
 * nobody behind it. An out-of-office is a robot, and two robots writing to
 * each other is how a thread ends up forty messages long.
 */

/** Verdicts a machine may answer on its own. */
const ANSWERABLE: Verdict[] = ["deal", "keen", "question", "changes", "cool"];

export const canAnswer = (verdict: Verdict) => ANSWERABLE.includes(verdict);

const AnswerSchema = z.object({
  body: z.string().trim().min(20).max(900),
});

/**
 * What to say, by what they said.
 *
 * Written as instructions rather than templates because the same verdict
 * arrives in very different words — "how much" and "I'd want to see it on my
 * own domain first" are both `keen` — and a template answers the category
 * instead of the person.
 */
const BRIEF: Record<Verdict, string> = {
  deal: `They have agreed. Say you will get started, and tell them the invoice is on its way and that the site moves to their own name once it is paid. Two sentences. Do not re-sell it, do not add conditions they have not heard, and do not ask another question — they have said yes and every extra sentence is a chance to change their mind.`,
  keen: `They are interested. Confirm you can do it, say what happens next in one step, and ask the one question you actually need answered to move — usually whether they want it on their own domain name. If you were told a price, give it plainly. If you were not, say you will send the number rather than inventing one.`,
  question: `They asked something. Answer it directly in the first sentence. Do not sell. If the question is how you got their details, the true answer is that their business is on Google Maps with no website listed, and saying so plainly is better than being vague about it.`,
  changes: `They want the site changed. Thank them for the specifics, say you will make the change, and confirm nothing else. Do not promise a date. Do not ask them to approve anything yet.`,
  cool: `They are not interested. One short line: fair enough, the site stays up for a week if they change their mind, and you will not write again. Do not attempt to reopen it. This is the last message.`,
  stop: "",
  auto: "",
  bounced: "",
};

const SYSTEM = `You are a freelance web designer replying to a local business owner who has answered your message about a website you built for them.

You are writing the next message in a real conversation. It is short, it is from one person to another, and it is the second thing they have ever heard from you.

Never:
- Invent a fact about their business, their trade, or their customers.
- Promise a result, a ranking, a date, or a guarantee.
- Quote a price you were not given.
- Apologise for something that did not happen.
- Agree to work that was not discussed.
- Use marketing voice, exclamation marks, capitals for emphasis, or emoji.
- Repeat the link unless they asked where it was.

Always:
- Answer the thing they actually said, in the first sentence.
- Keep it to three sentences or fewer.
- Sound like the same person who sent the first message.

If you do not know something, say you will find out. That is a real sentence a real person writes, and it is better than a confident wrong answer.`;

export interface Answered {
  body: string;
  problems: PitchProblem[];
  /** True when a `bad` problem survived. Do not send it. */
  blocked: boolean;
  tokens: number;
}

/**
 * Writes the reply.
 *
 * The whole thread goes in, not just the last message, because "yes" only
 * means something next to what it is answering — and because a second reply
 * that repeats the first is how an automatic conversation gives itself away.
 */
export const writeAnswer = async ({
  verdict,
  thread,
  business,
  siteUrl,
  sender,
  channel,
}: {
  verdict: Verdict;
  thread: { side: "us" | "them"; text: string }[];
  business: string;
  siteUrl: string;
  sender: Sender;
  channel: PitchChannel;
}): Promise<Answered | null> => {
  if (!canAnswer(verdict)) return null;

  const price = priceNote(sender.priceBand);
  const texting = channel === "sms";

  const conversation = thread
    .slice(-6)
    .map((m) => `${m.side === "us" ? "You" : business}: ${m.text.trim()}`)
    .join("\n\n");

  const user = [
    `The business: ${business}`,
    `The site you built them: ${siteUrl}`,
    `You are: ${sender.tradingName}`,
    price ? `What you charge: ${price}` : "You have not set a price. Do not name one.",
    `Voice: ${pitchTone(sender.tone)}`,
    "",
    "The conversation so far:",
    "",
    conversation,
    "",
    `What to do: ${BRIEF[verdict]}`,
    "",
    texting
      ? "This is a text message. Under 300 characters. No sign-off — one is added for you."
      : "This is an email reply. Three sentences or fewer. No sign-off — one is added for you.",
    "",
    'Return JSON and nothing else: {"body": "the reply"}',
  ].join("\n");

  const { value, tokens } = await askJson(AnswerSchema, {
    system: SYSTEM,
    user,
    maxTokens: 1200,
    thinking: "low",
    // Lower than the pitch's. A pitch has to avoid sounding templated across
    // four hundred businesses; a reply only has to be right.
    temperature: 0.5,
  });

  const body = texting
    ? `${value.body.trim()}\n— ${sender.tradingName}`
    : `${value.body.trim()}\n\n—\n${sender.tradingName}`;

  const problems = checkPitch({
    subject: "",
    body,
    business,
    siteUrl,
    pricing: Boolean(price),
    channel,
    // A reply is not required to carry the link. It already went out in the
    // first message, and repeating it in every answer is what a mailshot does.
    reply: true,
  });

  return {
    body,
    problems,
    blocked: problems.some((p) => p.severity === "bad"),
    tokens,
  };
};
