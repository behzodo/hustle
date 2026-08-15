import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

/**
 * The door the Inngest job comes through.
 *
 * The agent run cannot live inside Convex — it drives an E2B sandbox with a
 * 30-minute timeout and a 15-iteration agent network, while a Convex action
 * is capped at 10 minutes. So Inngest keeps orchestrating and calls back here
 * to persist what it produced.
 *
 * ConvexHttpClient can only reach *public* functions, and the write path must
 * not be public — anyone could forge assistant messages into any project. So
 * this HTTP action holds the shared secret and calls the internal mutation on
 * the caller's behalf.
 *
 * Set the secret on both sides:
 *   npx convex env set AGENT_WEBHOOK_SECRET "<random>"
 *   AGENT_WEBHOOK_SECRET=<same> in .env for the Next.js/Inngest process
 */
const authorized = (request: Request) => {
  const secret = process.env.AGENT_WEBHOOK_SECRET;
  if (!secret) return false;

  const header = request.headers.get("Authorization");
  return header === `Bearer ${secret}`;
};

const http = httpRouter();

http.route({
  path: "/agent/result",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();

    const messageId = await ctx.runMutation(internal.messages.recordResult, {
      projectId: body.projectId,
      content: body.content,
      type: body.type,
      fragment: body.fragment,
    });

    return Response.json({ messageId });
  }),
});

http.route({
  path: "/agent/context",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();

    const messages = await ctx.runQuery(internal.messages.recentForAgent, {
      projectId: body.projectId,
      take: body.take,
    });

    return Response.json({ messages });
  }),
});

export default http;
