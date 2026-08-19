import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { checkReplies, draftPitches, sendPitches } from "@/pitch-queue";

/**
 * The three things that can be done to a hustle's outreach.
 *
 * One route rather than three, because they are the same job at three stages
 * and every one of them needs the same two checks in front of it: is this
 * person signed in, and is this their hustle. Splitting them would be three
 * copies of that.
 *
 * Like the build route, this returns as soon as the work is started. Drafting
 * a patch is a few hundred model calls and sending is deliberately slower than
 * that — no browser holds a request open for either. What the screen watches
 * afterwards is `pitches.list`, which Convex pushes as each row changes.
 *
 * And like the build route, the run continuing after the response is a
 * property of a long-lived node process. On a serverless platform this needs
 * to be an Inngest function; the note there applies here word for word.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const { userId, getToken } = await auth();

  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "draft");

  if (!["draft", "send", "replies"].includes(action)) {
    return new Response("Unknown action", { status: 400 });
  }

  // Checked rather than trusted. Everything past this line either spends the
  // account's model allowance or sends email from a real person's inbox.
  let capacity: {
    mailboxes: number;
    sendable: number;
    remainingToday: number;
  } | null = null;

  try {
    const token = await getToken({ template: "convex" });
    if (!token) return new Response("Unauthorized", { status: 401 });

    const project = await fetchQuery(
      api.projects.get,
      { projectId: projectId as Id<"projects"> },
      { token },
    );

    if (!project) return new Response("Not found", { status: 404 });

    capacity = await fetchQuery(api.mailboxes.capacity, {}, { token });
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (action === "draft") {
    void draftPitches(projectId).catch((cause) => {
      console.error(`[pitch] drafting for ${projectId} stopped:`, cause);
    });

    return Response.json({ started: true });
  }

  // Both of the remaining actions need somewhere to send from, so it is
  // checked here — before anything is queued — rather than discovered one row
  // at a time by a worker that can only mark them failed.
  //
  // Capacity rather than existence. A user with four mailboxes that have all
  // hit today's ceiling is in a different situation from one with none, and
  // the queue would stop identically in both — so the difference has to be
  // said here or it is never said at all.
  if (!capacity || capacity.sendable === 0) {
    return Response.json(
      {
        error:
          capacity && capacity.mailboxes > 0
            ? "Every mailbox is paused or still being set up."
            : "Add a mailbox first, or connect a Google account.",
      },
      { status: 409 },
    );
  }

  if (action === "send" && capacity.remainingToday === 0) {
    return Response.json(
      {
        error:
          "Today's sending allowance is used up. The queue picks up again tomorrow.",
      },
      { status: 409 },
    );
  }

  if (action === "send") {
    void sendPitches(projectId).catch((cause) => {
      console.error(`[pitch] sending for ${projectId} stopped:`, cause);
    });

    return Response.json({ started: true });
  }

  // Replies are the one action worth waiting for: it is a handful of reads
  // against threads that mostly have not moved, and the screen has nothing
  // useful to show while it happens.
  const result = await checkReplies(projectId);

  return Response.json(result);
}
