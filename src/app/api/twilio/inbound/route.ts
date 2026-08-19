import { appendPitchMessage, findInboundPitch, recordPitchReply } from "@/inngest/convex";
import { writeAnswer } from "@/pitch/answer";
import { readReply } from "@/pitch/read-reply";
import { authTokenFor, sendText, signatureValid } from "@/pitch/twilio";
import { closeIfAgreed } from "@/pay/close";

/**
 * A text arriving from a business, and the answer going back.
 *
 * The fast half of the loop, and the reason this is a webhook rather than a
 * poll: Twilio posts here the moment the message lands, so the whole round
 * trip — read it, work out what it means, write a reply, send it — happens in
 * about four seconds while the owner still has their phone in their hand.
 *
 * The endpoint is public. It has to be; Twilio posts from its own servers with
 * no shared secret of ours. So the signature check below is the only thing
 * standing between this and anybody who finds the URL forging a reply from any
 * business and making the auto-answer text a number of their choosing on the
 * user's account and at the user's expense. It is not optional and it runs
 * before anything is written.
 */

/** Twilio wants XML back. An empty document means "no automatic reply". */
const NOTHING = new Response(
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
  { headers: { "content-type": "text/xml" } },
);

export async function POST(request: Request) {
  const raw = await request.text();
  const params = Object.fromEntries(new URLSearchParams(raw));

  const from = params.From;
  const to = params.To;
  const text = (params.Body ?? "").trim();

  if (!from || !to) return NOTHING;

  // Whose number was texted, and which conversation it belongs to. Read first
  // because the key that verifies the signature hangs off the connection this
  // lookup returns — and a read is harmless whether or not the caller is real.
  const { found } = await findInboundPitch({ from, to });

  if (!found) return NOTHING;

  try {
    const authToken = await authTokenFor(found.connectionId);

    // Twilio signs the exact URL it posted to, so this has to be the public
    // one rather than whatever the request object reports behind a proxy.
    const url = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")}/api/twilio/inbound`;
    const signature = request.headers.get("x-twilio-signature") ?? "";

    if (!signatureValid({ url, params, signature, authToken })) {
      return new Response("Bad signature", { status: 403 });
    }
  } catch {
    return new Response("Could not verify", { status: 403 });
  }

  if (!found.pitchId || !found.business || !found.siteUrl) {
    // A text from a number nobody pitched. Nothing to file it against, and
    // answering a stranger who texted the user's business line is not this
    // system's job.
    return NOTHING;
  }

  const thread = [...found.thread, { side: "them" as const, text, at: Date.now() }];

  // What they actually said. The pattern checks inside `readReply` run before
  // any model does, so STOP is honoured without a model being consulted about
  // whether it really meant it.
  const reading = await readReply(text);

  await recordPitchReply({
    pitchId: found.pitchId,
    messages: thread,
    verdict: reading.verdict,
    gist: reading.gist,
  });

  // The invoice, when they have actually agreed rather than merely asked. It
  // is raised before the reply is written so the link can go in the same text
  // — two messages a second apart read as a bot, and one reads as a person who
  // had it ready.
  const closed = await closeIfAgreed({
    pitchId: found.pitchId,
    verdict: reading.verdict,
    business: found.business,
    siteUrl: found.siteUrl,
    channel: "sms",
    to: from,
    invoiced: found.invoiced,
    sender: found.sender,
  }).catch((cause) => {
    console.error("[pitch] could not raise an invoice:", cause);
    return null;
  });

  const answer = await writeAnswer({
    verdict: reading.verdict,
    thread,
    business: found.business,
    siteUrl: found.siteUrl,
    sender: found.sender,
    channel: "sms",
  });

  // No answer, or one the checker refused. Both leave the reply filed and
  // unanswered, which is a conversation waiting for a person rather than a
  // wrong thing sent quickly. The invoice still stands — it is raised, it is
  // recorded, and the screen shows it.
  if (!answer || answer.blocked) return NOTHING;

  // The invoice line goes on the end of the answer rather than after it, so
  // the business gets one text with everything in it. Two messages a second
  // apart read as a bot; one reads as somebody who had it ready.
  const body = closed ? [answer.body, closed.line].join("\n\n") : answer.body;

  try {
    await sendText(found.connectionId, { to: from, from: to, body });

    await appendPitchMessage({ pitchId: found.pitchId, side: "us", text: body });
  } catch (cause) {
    console.error("[pitch] could not answer a text:", cause);
  }

  return NOTHING;
}
