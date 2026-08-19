import { checkReplies } from "@/pitch-queue";

/**
 * The door the minute-by-minute heartbeat knocks on.
 *
 * Convex runs the clock — see convex/crons.ts — and this does the work,
 * because the work needs two things Convex cannot reach: Nango, which holds
 * the Gmail token, and the free-tier model stack that writes the answer.
 *
 * Called with the same shared secret the Inngest bridge uses, for the same
 * reason: there is no browser session on this side, so the secret is what
 * stands in for an identity. Without it, anybody could make this read a
 * stranger's inbox on a schedule.
 */
export async function POST(request: Request) {
  const secret = process.env.AGENT_WEBHOOK_SECRET;

  if (!secret || request.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mailboxes: {
    projectId: string;
    connectionId: string;
    email: string;
  }[] = Array.isArray(body?.mailboxes) ? body.mailboxes : [];

  // Sequential rather than parallel. This runs every sixty seconds against the
  // same three free model tiers the drafting queue uses, and a fan-out here
  // would spend a minute's whole allowance on polling in the first second of
  // it — starving the thing that actually writes the pitches.
  let checked = 0;
  let answered = 0;

  for (const mailbox of mailboxes) {
    try {
      const result = await checkReplies(
        mailbox.projectId,
        mailbox.connectionId,
        mailbox.email,
      );

      checked += result.checked;
      answered += result.replies.length;
    } catch (cause) {
      // One mailbox with a revoked token must not stop the others. The next
      // minute tries again, and a connection that stays broken shows up on the
      // connections screen rather than here.
      console.error(`[pitch] tick failed for ${mailbox.projectId}:`, cause);
    }
  }

  return Response.json({ mailboxes: mailboxes.length, checked, answered });
}
