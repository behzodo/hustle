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
      bench: body.bench,
    });

    return Response.json({ messageId });
  }),
});

/**
 * The fast lane's three calls, for one lead's site.
 *
 * Separate routes rather than one because they happen at different moments and
 * two of them can be the last thing that happens: read what is known, reserve
 * the address, then say how it went. A build that dies between the second and
 * the third leaves a lead marked "building" with an address held, which is
 * exactly what a retry wants to find.
 */
http.route({
  path: "/site/context",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();
    const lead = await ctx.runQuery(internal.sites.leadForBuild, { leadId: body.leadId });

    return Response.json({ lead });
  }),
});

/**
 * The queue's two calls: fill it, and take the next thing off it.
 *
 * Taking is a mutation rather than a query because it also claims — see
 * `takeNext`. Two workers asking at the same moment must not be handed the
 * same business.
 */
http.route({
  path: "/site/queue",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();

    const result = await ctx.runMutation(internal.sites.queueProject, {
      projectId: body.projectId,
      rebuild: body.rebuild,
    });

    return Response.json(result);
  }),
});

http.route({
  path: "/site/next",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();
    const next = await ctx.runMutation(internal.sites.takeNext, {
      projectId: body.projectId,
    });

    return Response.json({ next });
  }),
});

http.route({
  path: "/site/claim",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();

    const site = await ctx.runMutation(internal.sites.claimForLead, {
      leadId: body.leadId,
      candidates: body.candidates,
      domain: body.domain,
    });

    return Response.json(site);
  }),
});

http.route({
  path: "/site/result",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();

    if (body.error) {
      await ctx.runMutation(internal.sites.failLead, {
        leadId: body.leadId,
        error: body.error,
      });
    } else {
      await ctx.runMutation(internal.sites.recordLead, {
        leadId: body.leadId,
        slug: body.slug,
        url: body.url,
        template: body.template,
        build: body.build,
      });
    }

    return Response.json({ ok: true });
  }),
});

/**
 * Claims the subdomain a project's site is published at.
 *
 * A separate call from `/agent/result` because it has to happen before the
 * upload, not after: the files go into the bucket under the slug, so the name
 * has to be settled while there is still time to fail cheaply.
 */
http.route({
  path: "/agent/site",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();

    const site = await ctx.runMutation(internal.projects.claimSite, {
      projectId: body.projectId,
      candidates: body.candidates,
      domain: body.domain,
    });

    return Response.json(site);
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

    // Both in one call. The build asks for context once, at the start, and
    // the project's name is wanted at the other end of the run to derive the
    // published address from — fetching it here costs nothing and saves a
    // second round trip half an hour later.
    const [messages, project] = await Promise.all([
      ctx.runQuery(internal.messages.recentForAgent, {
        projectId: body.projectId,
        take: body.take,
      }),
      ctx.runQuery(internal.projects.basicsForAgent, { projectId: body.projectId }),
    ]);

    return Response.json({ messages, project });
  }),
});

/* -------------------------------------------------------------------------- *
 * The pitch lane.
 *
 * Six routes rather than three, because sending has a step the build lane does
 * not: the address has to be found before anything can be written, and finding
 * it means fetching somebody else's web page — which Convex is the wrong place
 * to do from, and which fails often enough that it needs its own record.
 * -------------------------------------------------------------------------- */

http.route({
  path: "/pitch/context",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();
    const lead = await ctx.runQuery(internal.pitches.context, { leadId: body.leadId });

    return Response.json({ lead });
  }),
});

http.route({
  path: "/pitch/targets",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();
    const leads = await ctx.runQuery(internal.pitches.toDraft, {
      projectId: body.projectId,
      limit: body.limit,
    });

    return Response.json({ leads });
  }),
});

http.route({
  path: "/pitch/email",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();

    await ctx.runMutation(internal.pitches.recordEmail, {
      leadId: body.leadId,
      email: body.email,
      source: body.source,
    });

    return Response.json({ ok: true });
  }),
});

http.route({
  path: "/pitch/draft",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();
    const pitchId = await ctx.runMutation(internal.pitches.saveDraft, body);

    return Response.json({ pitchId });
  }),
});

http.route({
  path: "/pitch/queue",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();
    const result = await ctx.runMutation(internal.pitches.queueProject, {
      projectId: body.projectId,
    });

    return Response.json(result);
  }),
});

http.route({
  path: "/pitch/next",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();
    const next = await ctx.runMutation(internal.pitches.takeNext, {
      projectId: body.projectId,
    });

    return Response.json({ next });
  }),
});

http.route({
  path: "/pitch/sent",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();

    await ctx.runMutation(internal.pitches.recordSent, {
      pitchId: body.pitchId,
      gmail: body.gmail,
      error: body.error,
    });

    return Response.json({ ok: true });
  }),
});

/** Everything still waiting on an answer, and what came back. */
http.route({
  path: "/pitch/open",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();
    const open = await ctx.runQuery(internal.pitches.awaitingReply, {
      projectId: body.projectId,
    });

    return Response.json({ open });
  }),
});

http.route({
  path: "/pitch/reply",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

    const body = await request.json();

    await ctx.runMutation(internal.pitches.recordReply, {
      pitchId: body.pitchId,
      messages: body.messages,
      verdict: body.verdict,
      gist: body.gist,
    });

    return Response.json({ ok: true });
  }),
});

export default http;
