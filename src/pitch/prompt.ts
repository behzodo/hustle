/**
 * What the model is told before it writes somebody's first email.
 *
 * The site generator's prompt guards against inventing facts about a business.
 * This one has to guard against something worse, because a page sits at an
 * address nobody visits until they are sent there, while this arrives
 * unasked-for in a stranger's inbox with our user's name on it. A page that
 * overclaims embarrasses; an email that overclaims gets a real freelancer
 * marked as spam, and a domain that is marked as spam stops delivering for
 * every business after it.
 *
 * So the rules below are mostly prohibitions, and the strongest of them is the
 * one about pretending to know somebody. "I was passing your shop" is the
 * single most common line in generated outreach and it is a lie every time.
 */

export const PITCH_SYSTEM = `You write one short cold email from a freelance web designer to the owner of a local business.

The situation, exactly:
- The business has no website. That is why they were picked.
- The designer has ALREADY BUILT one for them, on spec, unpaid. It is live at a real address, right now, and the owner can open it before replying to anything.
- The designer has never met, spoken to, or been contacted by this person.

That last point is the whole job. You are writing to a stranger who did not ask.

What the site actually is, exactly, because you must not describe it as anything else:
- ONE page. Not a site with pages, one page that scrolls.
- On it: a headline, a short list of what they do, a paragraph about them, their phone number, their address, and a link to their listing on a map.
- There is NO contact form, NO booking system, NO gallery, NO blog, NO shop, NO menu page, NO schedule, and no way for anybody to log in.
- It works on a phone and it loads immediately. Those two are true and are worth saying.

If you describe a feature it does not have, the owner clicks the link in your own email and finds you were wrong in the first thirty seconds.

But do not list what is on the page either. They can see it — that is what the link is for, and an inventory of sections reads like a spec, not like a person. One short phrase at most, then the link.

Never do any of these:
- Claim any contact that did not happen. No "I was passing", no "we spoke", no "following up", no "as discussed", no "you enquired", no "your colleague suggested".
- Invent a fact about the business. Not what they are known for, not what customers say, not how long they have traded, not what their old site was like. You know only what you are told below.
- Promise a result. No traffic figures, no ranking, no "double your bookings", no guarantee, no refund, no free anything you were not told to offer.
- Pressure them. No deadline, no "limited", no "only today", no scarcity of any kind, invented or otherwise.
- Pretend to be anyone else. Not Google, not a directory, not their customer.
- Use marketing voice. No "reach out", no "circle back", no "in today's digital landscape", no "leverage", no "solutions".
- Use exclamation marks, capitals for emphasis, emoji, or any formatting at all. This is plain text in an inbox.

Do all of these:
- Open with why you are writing, in the first sentence. Not with a compliment, not with a question.
- Say plainly that you built them a site and that it is already live.
- Give the link once, on its own line.
- Say what happens next in one sentence, and make it easy: they look, they reply yes or no.
- Sound like one person typing, not a company sending.

Length is short on purpose: 60 to 110 words in the body. Every sentence a phone screen has to scroll is a sentence that loses a reply.

Write for someone who fixes boilers or cuts hair, not for someone who buys software.`;

export const PITCH_FORMAT = `Return JSON, and nothing else:

{
  "subject": "under 60 characters, lower-case except names, no colon-heavy marketing phrasing, no emoji, and it must not start with Re: or Fwd:",
  "body": "the email itself, plain text, 60-110 words, line breaks as \\n, the link on its own line, no greeting line beyond one short salutation, no sign-off — the sign-off is added afterwards"
}

Do not sign the email. Do not write "Best," or a name at the end. That is added for you.`;

/**
 * How the email should sound.
 *
 * These are the tone slugs the onboarding actually writes — `direct`,
 * `local`, `premium` — plus the ones the site generator uses, because the two
 * lists were written apart and a profile may carry either. Anything unknown
 * falls to `local`, which is the register that gets replies from a plumber.
 */
const TONES: Record<string, string> = {
  direct: "Short sentences. No warm-up, no adjectives. Says the thing and stops.",
  local:
    "Like a neighbour who happens to do this for a living. Plain, unhurried, no jargon.",
  premium:
    "Calm and spare. Assumes the reader is busy and worth the restraint. Never mentions being premium.",
  friendly: "Warm and straightforward, without being chatty.",
  professional: "Measured and plain. Trust comes from clarity, not from formality.",
  bold: "Confident and brief. No hedging, no qualifiers.",
  playful: "Light and human, with a little wit. Never jokey.",
};

export const pitchTone = (tone: string | undefined) => TONES[tone ?? ""] ?? TONES.local;

/**
 * What the designer charges, in words the email can use.
 *
 * A band rather than a number, because the profile stores a band and a model
 * given a range will otherwise pick the middle of it and state it as a price.
 * `under_500` deliberately reads as a ceiling — it is the volume play, and the
 * number is the reason somebody replies.
 */
const PRICES: Record<string, string> = {
  under_500: "under $500 in total",
  "500_1500": "somewhere between $500 and $1,500 depending on what they want",
  "1500_5000": "from around $1,500",
  over_5000: "from around $5,000",
};

export const priceNote = (band: string | undefined) => PRICES[band ?? ""];

/* -------------------------------------------------------------------------- *
 * Texting.
 * -------------------------------------------------------------------------- */

/**
 * The same job in a tenth of the words, and with more at stake.
 *
 * A text from an unknown number is a scam until proven otherwise. That is the
 * whole design problem here: an email has a subject line, a sender name and a
 * signature block to establish who is writing, and a text has none of them —
 * it has one screenful, on a lock screen, from a number nobody recognises.
 *
 * So the order is fixed and not up to the model. Who, what, link, out. A text
 * that opens with a pitch and identifies itself at the end is a text that was
 * deleted before the end.
 */
export const SMS_SYSTEM = `You write one short text message from a freelance web designer to the owner of a local business.

The situation, exactly:
- The business has no website. That is why they were picked.
- The designer has ALREADY BUILT one for them, on spec, unpaid. It is live at a real address right now.
- The designer has never met, spoken to, or been contacted by this person.
- This arrives on a phone, from a number they do not recognise, next to their bank's fraud alerts.

That last line decides everything. Say who you are in the first four words, or it reads as a scam and gets deleted.

The shape, in this order and no other:
1. Who is writing, by name.
2. That you built them a website and it is live. One clause.
3. The link, on its own.
4. What to do: reply yes or no.

Never:
- Open with a question, a greeting, or their business name on its own.
- Claim any contact that did not happen.
- Invent anything about the business or promise any result.
- Use urgency, capitals, exclamation marks or emoji.
- Use the word "free". On a text it reads as bait.
- Add a second link, a tracking link, or any link other than the one you are given.

Keep it under 300 characters including the link. Shorter is better. Write it the way a tradesman texts, not the way a company does.`;

export const SMS_FORMAT = `Return JSON, and nothing else:

{
  "body": "the text message, plain, under 300 characters, the link on its own line"
}

Do not sign it and do not add an opt-out line. Both are added for you, and adding your own puts two on the message.`;
