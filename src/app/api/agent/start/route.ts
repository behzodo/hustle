import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/../convex/_generated/api";
import { inngest } from "@/inngest/client";
import type { Id } from "@/../convex/_generated/dataModel";

/**
 * Starts an agent run. The browser calls this straight after the Convex
 * mutation that created the project or message.
 */
export async function POST(req: Request) {
  const { userId, getToken } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { projectId, value } = await req.json();

  if (typeof projectId !== "string" || typeof value !== "string") {
    return new Response("Bad request", { status: 400 });
  }

  // Ownership is re-checked here, not taken on trust from the client. Without
  // it anyone could spend a sandbox on someone else's project and write the
  // agent's reply into their history.
  try {
    const token = await getToken({ template: "convex" });
    if (!token) return new Response("Unauthorized", { status: 401 });

    await fetchQuery(
      api.projects.get,
      { projectId: projectId as Id<"projects"> },
      { token },
    );
  } catch {
    return new Response("Not found", { status: 404 });
  }

  await inngest.send({
    name: "code-agent/run",
    data: { value, projectId },
  });

  return Response.json({ ok: true });
}
