import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { runQueue } from "@/build-queue";

/**
 * Starts building every worth-pitching business in a hustle.
 *
 * Returns as soon as the queue is filled rather than when it is empty: a patch
 * is a few hundred businesses at seven seconds each, and no browser is going
 * to hold a request open for half an hour. What the caller gets back is the
 * size of the job; what it watches afterwards is `sites.feed`, which Convex
 * pushes as each site lands.
 *
 * The run itself continues on the server after the response. That is fine
 * where this is a long-lived node process and wrong on a serverless platform,
 * which will reap the function the moment the response is written — so the
 * production path is `fast-site/build` on Inngest, which exists and does the
 * same work per business. This route is what makes the button work today.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  // Rebuilding writes fresh copy over sites that already exist and keeps their
  // addresses, which is what makes it safe to offer: the link a client was
  // sent still resolves, to a better page. Absent means "only the ones that
  // have never been built", which is what the button does the first time.
  const rebuild = await request
    .json()
    .then((body) => Boolean(body?.rebuild))
    .catch(() => false);
  const { userId, getToken } = await auth();

  if (!userId) return new Response("Unauthorized", { status: 401 });

  // Ownership is checked here rather than trusted, because everything below
  // this line spends the account's model allowance and publishes under
  // somebody's name.
  try {
    const token = await getToken({ template: "convex" });
    if (!token) return new Response("Unauthorized", { status: 401 });

    const project = await fetchQuery(
      api.projects.get,
      { projectId: projectId as Id<"projects"> },
      { token },
    );

    if (!project) return new Response("Not found", { status: 404 });
  } catch {
    return new Response("Not found", { status: 404 });
  }

  // Not awaited. The queue writes its progress to Convex as it goes, and the
  // screen is already subscribed to that — so there is nothing in the result
  // this response could carry that the client will not have sooner anyway.
  void runQueue(projectId, { rebuild }).catch((cause) => {
    console.error(`[build] queue for ${projectId} stopped:`, cause);
  });

  return Response.json({ started: true });
}
