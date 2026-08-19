/**
 * Reading the email before anybody else does.
 *
 * The site checker exists because a page can claim something about a business
 * that is not true. This one exists because an email can do that *and* get a
 * real person's sending address blocked — and unlike a page, it cannot be
 * fixed after the fact. Once it is delivered it is delivered.
 *
 * Every pattern here is either a lie the model is prone to telling, or a
 * signal that spam filters weight heavily. Nothing here is about taste. A
 * clumsy sentence costs a reply; a fabricated prior conversation costs the
 * account.
 */

/** Body length, in words. The prompt asks for 60–110; this is the slack. */
const WORDS_MIN = 45;
const WORDS_MAX = 140;

/**
 * Claims of a relationship that does not exist.
 *
 * The most damaging class by a distance, and the one models reach for
 * unprompted because it is how every outreach email in their training data
 * opens. A business owner who is told "I was passing your shop" by somebody
 * who was not is being lied to in the first line.
 */
const FAMILIARITY: [RegExp, string][] = [
  [/\b(?:i|we)\s+(?:was|were)\s+(?:just\s+)?(?:passing|walking\s+past|driving\s+past|in\s+the\s+area)\b/i,
   "claims to have been there in person"],
  [/\b(?:as\s+(?:discussed|promised|mentioned)|per\s+our\s+(?:call|conversation|chat))\b/i,
   "refers to a conversation that never happened"],
  [/\b(?:following\s+up|circling\s+back|checking\s+in)\s+(?:on|about|re)\b/i,
   "presents itself as a follow-up to nothing"],
  [/\b(?:you|your\s+\w+)\s+(?:asked|enquired|inquired|requested|reached\s+out|got\s+in\s+touch)\b/i,
   "claims they contacted us first"],
  [/\b(?:we|i)\s+(?:spoke|met|chatted|talked)\b/i, "claims a prior conversation"],
  [/\b(?:your|a)\s+(?:colleague|neighbour|neighbor|friend|customer)\s+(?:suggested|recommended|passed|gave)\b/i,
   "invents a referral"],
];

/**
 * Things we cannot know about this business, or cannot promise about the work.
 *
 * Shares its reasoning with src/check/content.ts and about half its patterns.
 * Kept separate rather than imported because the two run over different things
 * — that one reads six short fields, this reads a paragraph — and a shared
 * list would grow patterns that only make sense on one side.
 */
const OVERCLAIM: [RegExp, string][] = [
  [/\b(?:guarantee[ds]?|guaranteed|money[- ]back|no\s+risk|risk[- ]free)\b/i,
   "guarantees something"],
  [/\b(?:double|triple|increase|boost|grow)\s+(?:your\s+)?(?:bookings?|sales|revenue|traffic|customers?|leads?)\b/i,
   "promises a business result"],
  [/\b(?:rank(?:ing)?\s+(?:you\s+)?(?:number\s*1|first|top)|page\s+one\s+of\s+google|top\s+of\s+google)\b/i,
   "promises a search ranking"],
  [/\b\d+\s*%\s*(?:more|increase|growth|uplift)\b/i, "quotes a figure it cannot know"],
  [/\byour\s+(?:customers?|clients?)\s+(?:say|tell|love|rave)\b/i,
   "invents what their customers think"],
  [/\b(?:award[- ]winning|certified|accredited|licen[cs]ed|insured|family[- ](?:run|owned))\b/i,
   "states a credential nobody verified"],
  [/\b(?:for\s+)?free\b(?!\s*(?:to|feel))/i,
   "offers something free — the site is already built, saying free reads as bait"],
];

/**
 * Pressure. All of it invented, because there is no deadline here.
 *
 * A cold email with urgency in it is a cold email that has decided the reader
 * needs managing. It also happens to be what every filter looks for.
 */
const PRESSURE: [RegExp, string][] = [
  [/\b(?:limited\s+time|act\s+now|last\s+chance|don'?t\s+miss|expires?|hurry|today\s+only|while\s+(?:stocks|slots)\s+last)\b/i,
   "manufactures urgency"],
  [/\b(?:only\s+\d+\s+(?:spots?|slots?|places?)|\d+\s+left)\b/i, "invents scarcity"],
  [/\b(?:before\s+(?:someone\s+else|a\s+competitor)|your\s+competitors?\s+(?:are|will))\b/i,
   "uses fear of a competitor"],
];

/** Left in by a model that was writing a template rather than an email. */
const PLACEHOLDER =
  /\[(?:name|business|your\s+\w+|insert[^\]]*)\]|\{\{|\bXXX\b|\bTBD\b|\byour\s+business\s+name\b/i;

/** Formatting that does not belong in a plain-text email. */
const MARKUP = /\*\*|^#{1,6}\s|\]\(https?:|<\/?[a-z]+>/im;

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * How much a problem matters.
 *
 * Deliberately not the site checker's `Severity`, whose two values are
 * "drop the field" and "ask again" — neither of which means anything here,
 * because an email has no fields to drop. The question this side is only ever
 * whether the thing may be sent.
 */
export type PitchSeverity =
  /** Do not send. Rewrite it, or leave it for a person to fix. */
  | "bad"
  /** Send it. Worth showing on the screen, not worth stopping for. */
  | "soft";

export interface PitchProblem {
  /** "subject" or "body". */
  field: string;
  severity: PitchSeverity;
  message: string;
}

export interface PitchSubject {
  subject: string;
  body: string;
  /** The business this is going to, by name. It has to appear in the email. */
  business: string;
  /** The link that must appear exactly once. */
  siteUrl: string;
  /** Set when the profile has a price band, which is the only time a number is allowed. */
  pricing?: boolean;
}

/**
 * Everything wrong with a pitch, in one pass.
 *
 * Severity splits what blocks sending from what is only worth showing. A
 * fabricated relationship is `bad` and stops the email; a body four words over
 * length is `soft` and does not. The queue treats the two differently — see
 * composePitch — and both are stored, because a check that fired and was
 * overruled is still the only record that it fired.
 */
export const checkPitch = ({
  subject,
  body,
  business,
  siteUrl,
  pricing,
}: PitchSubject): PitchProblem[] => {
  const problems: PitchProblem[] = [];
  const say = (field: string, severity: PitchSeverity, message: string) =>
    problems.push({ field, severity, message });

  const whole = `${subject}\n${body}`;

  for (const [pattern, message] of FAMILIARITY) {
    if (pattern.test(whole)) say("body", "bad", message);
  }

  for (const [pattern, message] of OVERCLAIM) {
    if (pattern.test(whole)) say("body", "bad", message);
  }

  for (const [pattern, message] of PRESSURE) {
    if (pattern.test(whole)) say("body", "bad", message);
  }

  if (PLACEHOLDER.test(whole)) say("body", "bad", "still has a template placeholder in it");
  if (MARKUP.test(body)) say("body", "bad", "contains formatting — this is a plain-text email");

  /* ---- the link ---- */

  // Exactly once. Twice reads as a mailshot and doubles the thing a filter
  // scores; never at all is an email about a website with no website in it,
  // which is the single most expensive way this can fail.
  const links = body.split(siteUrl).length - 1;

  if (links === 0) say("body", "bad", "does not contain the link to their site");
  if (links > 1) say("body", "bad", `repeats the link ${links} times — it belongs on one line, once`);

  // Any other link is either a hallucination or a tracker nobody asked for.
  const others = [...body.matchAll(/https?:\/\/[^\s<>")]+/gi)]
    .map((m) => m[0].replace(/[.,)]+$/, ""))
    .filter((url) => url !== siteUrl);

  if (others.length) say("body", "bad", `links somewhere it should not: ${others[0]}`);

  /* ---- the business ---- */

  // Their name, spelled their way. An email to a shop that never says the
  // shop's name is indistinguishable from one sent to ten thousand shops.
  const first = business.split(/[\s|,–-]/)[0];

  if (first.length > 2 && !new RegExp(escape(first), "i").test(body)) {
    say("body", "soft", "never says the business's name");
  }

  /* ---- shape ---- */

  const count = words(body);

  if (count < WORDS_MIN) say("body", "soft", `too short at ${count} words`);
  if (count > WORDS_MAX) say("body", "soft", `too long at ${count} words — a phone shows about 60`);

  if ((body.match(/!/g) ?? []).length > 0) say("body", "soft", "uses an exclamation mark");
  // Shouting — with the business's own name taken out first.
  //
  // A great many of these are acronyms. BFND Food Truck, MUMDA, JCA: all real,
  // all out of one sweep of one town. Looking for capitals without removing the
  // recipient's name first refuses an email for containing the name of the
  // person it is addressed to, which is exactly what the first run of
  // scripts/pitch-check.ts did.
  const shouty = (text: string) =>
    /[A-Z]{4,}/.test(
      business
        .split(/\s+/)
        .filter((word) => word.length > 1)
        .reduce((out, word) => out.split(word).join(" "), text),
    );

  if (shouty(subject)) say("subject", "soft", "shouts in capitals");
  if (shouty(body)) say("body", "soft", "shouts in capitals");

  /* ---- what the site actually is ---- */

  // Claims about the thing we built, rather than about the business.
  //
  // Found by reading three generated pitches: one offered a schedule page
  // where clients could see class times, another a photo gallery and a
  // contact form. The site is a single page — hero, services, about, phone
  // and address — and has none of those. It is the same class of lie as
  // inventing a guarantee, except that this one gets discovered the second
  // the recipient clicks the link in the email that told it.
  const INVENTED_FEATURE =
    /\b(?:contact\s+form|booking\s+(?:system|form|page)|online\s+booking|book\s+online|photo\s+gallery|gallery\s+(?:page|section)|blog|shopping\s+cart|online\s+(?:shop|store)|e-?commerce|schedule\s+page|menu\s+page|\d+\s+pages?|multiple\s+pages|newsletter|sign[- ]?up\s+form|live\s+chat)\b/i;

  const feature = body.match(INVENTED_FEATURE);

  if (feature) {
    say("body", "bad", `describes something the site does not have: "${feature[0]}"`);
  }

  // A price the profile did not set is a price the model made up, and it is
  // the number the client will hold us to.
  if (!pricing && /(?:[$£€]\s?\d|\b\d+\s*(?:dollars|pounds|usd|gbp)\b)/i.test(body)) {
    say("body", "bad", "names a price that is not on the profile");
  }

  return problems;
};

/** Escapes a business name for use inside a regex — apostrophes and all. */
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
