import { v, ConvexError } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { CREDIT_COSTS, refund, spend } from "./credits";

/**
 * Addresses, and who holds them.
 *
 * Two tables publish sites under one domain. A project publishes the site its
 * chat produced; a lead publishes the site the fast lane built for it. They
 * are different rows in different tables and they are competing for the same
 * subdomain, so neither may claim a name without looking at both — a lead
 * called "Fade Room" and a hustle a user also called "Fade Room" would
 * otherwise both be handed `fade-room`, and the second upload would quietly
 * replace the first person's site.
 *
 * Everything to do with that shared namespace lives here so there is one place
 * to read when the answer to "who owns this address" matters.
 */

/**
 * How long a build may sit claimed before the queue takes it back.
 *
 * "building" is a claim, not a fact. A worker that is killed — a deploy, a
 * crashed process, a laptop lid — leaves it set with nothing behind it, and a
 * queue that respects that claim forever quietly loses the business rather
 * than failing at it.
 *
 * Fifteen minutes is far beyond a build that takes four seconds, and well
 * inside the patience of whoever is waiting for the patch to finish.
 */
const STALE_BUILD_MS = 15 * 60 * 1000;

const stale = (lead: { siteStatus?: string; siteStartedAt?: number }, now: number) =>
  lead.siteStatus === "building" &&
  now - (lead.siteStartedAt ?? 0) > STALE_BUILD_MS;

/** Whether anything already publishes at this slug. */
export const taken = async (ctx: QueryCtx, slug: string) => {
  const project = await ctx.db
    .query("projects")
    .withIndex("by_slug", (q) => q.eq("site.slug", slug))
    .first();

  if (project) return true;

  const lead = await ctx.db
    .query("leads")
    .withIndex("by_slug", (q) => q.eq("site.slug", slug))
    .first();

  return Boolean(lead);
};

/**
 * Claims an address for one lead.
 *
 * Returns what it already holds if it has published before, which is what
 * makes a rebuild land on the same URL a client was sent rather than beside
 * it. `publishedAt` is not set here — the name is reserved now and the upload
 * has not happened yet, and the difference between the two is what
 * `recordLead` below is for.
 */
export const claimForLead = internalMutation({
  args: {
    leadId: v.id("leads"),
    candidates: v.array(v.string()),
    domain: v.string(),
  },
  returns: v.object({ slug: v.string(), url: v.string() }),
  handler: async (ctx, { leadId, candidates, domain }) => {
    const lead = await ctx.db.get(leadId);

    if (!lead) {
      throw new ConvexError({ code: "NOT_FOUND", message: "That lead no longer exists." });
    }

    // Charged here because this is the gate every build goes through, on both
    // lanes, and it sits before the first model call — the cheapest place to
    // refuse and the only one that cannot be skipped.
    //
    // A rebuild pays again. It writes fresh copy, which is another model call
    // and another upload; the address staying the same is the point of a
    // rebuild, not a discount on one. Callers that do not want to pay twice
    // check `alreadyLive` and never get here — see src/inngest/fast.ts.
    await spend(ctx, lead.userId, "site", {
      projectId: lead.projectId,
      note: lead.name,
    });

    if (lead.site) return { slug: lead.site.slug, url: lead.site.url };

    for (const slug of candidates) {
      if (await taken(ctx, slug)) continue;

      const url = `https://${slug}.${domain}`;

      // Written with a placeholder timestamp so the slug is held against a
      // concurrent claim. Overwritten by recordLead when the files land.
      await ctx.db.patch(leadId, {
        site: { slug, url, template: "", publishedAt: 0 },
        siteStatus: "building",
        siteStartedAt: Date.now(),
      });

      return { slug, url };
    }

    throw new ConvexError({
      code: "SLUG_UNAVAILABLE",
      message: `No address is free for this business (tried ${candidates.join(", ")}).`,
    });
  },
});

/** Marks a lead's site as live, once its files are actually in the bucket. */
const buildRecord = v.object({
  provider: v.string(),
  tokens: v.number(),
  repairs: v.number(),
  seconds: v.number(),
  headline: v.string(),
  services: v.array(v.string()),
  problems: v.array(v.string()),
  photo: v.optional(v.string()),
});

export const recordLead = internalMutation({
  args: {
    leadId: v.id("leads"),
    slug: v.string(),
    url: v.string(),
    template: v.string(),
    build: v.optional(buildRecord),
  },
  returns: v.null(),
  handler: async (ctx, { leadId, slug, url, template, build }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead) return null;

    await ctx.db.patch(leadId, {
      site: {
        slug,
        url,
        template,
        publishedAt: Date.now(),
        build,
        // Carried across rather than rewritten. A rebuild replaces the page,
        // not the address it answers on — and this one was paid for, is in a
        // client's hands, and is not this mutation's to drop.
        ...(lead.site?.customDomain
          ? { customDomain: lead.site.customDomain }
          : {}),
      },
      siteStatus: "live",
      // Cleared rather than left behind: a lead that failed last night and
      // built this morning is not a lead with a problem.
      siteError: undefined,
    });

    return null;
  },
});

/**
 * Records that a build did not work.
 *
 * The slug it reserved is deliberately left on the row. It costs nothing, it
 * keeps the retry landing on the same address, and releasing it would mean a
 * business that failed twice could come back under a different name than the
 * one already written into a draft email.
 */
export const failLead = internalMutation({
  args: { leadId: v.id("leads"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { leadId, error }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead) return null;

    await ctx.db.patch(leadId, {
      siteStatus: "failed",
      siteError: error.slice(0, 400),
    });

    // No site, no charge. `claimForLead` took the credit on the way in, and a
    // business whose page never went up did not get what that paid for.
    //
    // Not conditional on how far the build got, unlike a sweep: there is only
    // one outcome worth anything here and it is a live address.
    await refund(ctx, lead.userId, CREDIT_COSTS.site, `Build failed — ${lead.name}`);

    return null;
  },
});

/**
 * Everything the fast lane needs to build one site, in a single read.
 *
 * Three rows — the lead, its hustle, and the profile of whoever owns it —
 * because the build runs on Inngest and each of them would otherwise be a
 * round trip over HTTP to a different continent.
 *
 * The town comes off the hustle's patch rather than out of the address.
 * "Headingley, Leeds" is what the user drew and what a local would say; the
 * address line is a postcode and a street number and reads like a form.
 */
export const leadForBuild = internalQuery({
  args: { leadId: v.id("leads") },
  returns: v.union(
    v.object({
      name: v.string(),
      trade: v.string(),
      categories: v.array(v.string()),
      town: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      mapsUrl: v.optional(v.string()),
      rating: v.optional(v.number()),
      reviewCount: v.optional(v.number()),
      photo: v.optional(v.string()),
      tone: v.optional(v.string()),
      alreadyLive: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, { leadId }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead) return null;

    const project = await ctx.db.get(lead.projectId);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", lead.userId))
      .first();

    return {
      name: lead.name,
      // The first category is Google's own best guess at what the business is
      // and reads the way a person would say it. The rest go to the model as
      // context and to the template router, which often finds the useful word
      // in the second one — a barber listed as "Beauty salon, Barber shop".
      trade: lead.categories[0] ?? "Local business",
      categories: lead.categories,
      town: project?.area?.label,
      phone: lead.phone,
      address: lead.address,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lng}&query_place_id=${lead.placeId}`,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      photo: lead.photo,
      tone: profile?.tone,
      // Lets the caller skip work rather than rebuild a site nobody asked to
      // change — the queue will re-enqueue a lead more than once.
      alreadyLive: lead.siteStatus === "live",
    };
  },
});

/* -------------------------------------------------------------------------- *
 * The queue.
 *
 * A swept patch is a few hundred businesses and the fast lane can hold four at
 * once, so the work has to wait somewhere. It waits on the lead itself, in
 * `siteStatus`, rather than in a separate table — there is exactly one site per
 * business and a queue row would only ever be a second place to look for the
 * same fact, and a second place to get out of step with the first.
 *
 * Order is by score, best first. It is the difference between getting through
 * the fifty best businesses in a patch before the day ends and getting through
 * fifty arbitrary ones.
 * -------------------------------------------------------------------------- */

/**
 * Marks a hustle's worth-pitching businesses as waiting to be built.
 *
 * Only `target` leads: a business that already has a website of its own is in
 * the table as the denominator — "41 of 260 have no site" — and building it a
 * second website is work nobody asked for.
 *
 * Leads already live are left alone unless `rebuild` is set. Re-running a
 * whole patch is the normal way to pick up the businesses a previous run did
 * not reach, and it should not cost a model call for every one it did.
 */
/**
 * The queueing itself, as a plain function.
 *
 * Not a mutation calling a mutation: `startBuilds` below and `queueProject`
 * beside it both need this, and having one call the other through
 * `ctx.runMutation` makes each one's return type depend on the other's, which
 * TypeScript resolves by giving up and calling them both `any`. A shared
 * helper has one type and no cycle.
 */
const enqueue = async (
  ctx: MutationCtx,
  projectId: Id<"projects">,
  rebuild?: boolean,
) => {
  const leads = await ctx.db
    .query("leads")
    .withIndex("by_project_target_and_score", (q) =>
      q.eq("projectId", projectId).eq("target", true),
    )
    .collect();

  let queued = 0;
  let skipped = 0;
  const now = Date.now();

  for (const lead of leads) {
    // A live build is left alone in both modes: something is working on it
    // right now, and a second worker picking it up would publish twice. One
    // that has been claimed for a quarter of an hour is not a live build.
    if (lead.siteStatus === "building" && !stale(lead, now)) {
      skipped += 1;
      continue;
    }

    if (lead.siteStatus === "live" && !rebuild) {
      skipped += 1;
      continue;
    }

    await ctx.db.patch(lead._id, { siteStatus: "queued", siteError: undefined });
    queued += 1;
  }

  return { queued, skipped };
};

/** The same, for anything inside Convex that needs it. */
export const queueProject = internalMutation({
  args: { projectId: v.id("projects"), rebuild: v.optional(v.boolean()) },
  returns: v.object({ queued: v.number(), skipped: v.number() }),
  handler: (ctx, { projectId, rebuild }) => enqueue(ctx, projectId, rebuild),
});

/**
 * Takes the next business off the queue and marks it as being worked on.
 *
 * Claiming and reading are one mutation on purpose. Two workers that both read
 * "the best queued lead" and then both set it to building have each published
 * a site, to the same address, from two different drafts. A mutation is
 * serialised, so the second caller sees the first one's write and moves on to
 * the next lead.
 */
export const takeNext = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.union(v.object({ leadId: v.id("leads"), name: v.string(), score: v.number() }), v.null()),
  handler: async (ctx, { projectId }) => {
    const next = await ctx.db
      .query("leads")
      .withIndex("by_project_status_and_score", (q) =>
        q.eq("projectId", projectId).eq("siteStatus", "queued"),
      )
      // Best first. The index is ordered by score ascending, so the end of it
      // is the top of the queue.
      .order("desc")
      .first();

    if (!next) return null;

    await ctx.db.patch(next._id, {
      siteStatus: "building",
      siteStartedAt: Date.now(),
    });

    return { leadId: next._id, name: next.name, score: next.score };
  },
});

/** How far along a hustle's builds are. Public: this is what the screen shows. */
export const progress = query({
  args: { projectId: v.id("projects") },
  returns: v.object({
    queued: v.number(),
    building: v.number(),
    live: v.number(),
    failed: v.number(),
    targets: v.number(),
  }),
  handler: async (ctx, { projectId }) => {
    const userId = await requireUserId(ctx);
    const project = await ctx.db.get(projectId);

    if (!project || project.userId !== userId) {
      return { queued: 0, building: 0, live: 0, failed: 0, targets: 0 };
    }

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_project_target_and_score", (q) =>
        q.eq("projectId", projectId).eq("target", true),
      )
      .collect();

    const count = (status: string) =>
      leads.filter((lead) => lead.siteStatus === status).length;

    return {
      queued: count("queued"),
      building: count("building"),
      live: count("live"),
      failed: count("failed"),
      targets: leads.length,
    };
  },
});

/**
 * Puts a hustle's businesses in the build queue.
 *
 * Public, because this is the button. Ownership is checked here rather than
 * trusted from the caller — a project id is guessable and queueing somebody
 * else's patch would spend their allowance and publish under their names.
 */
export const startBuilds = mutation({
  args: { projectId: v.id("projects"), rebuild: v.optional(v.boolean()) },
  returns: v.object({ queued: v.number(), skipped: v.number() }),
  handler: async (ctx, { projectId, rebuild }) => {
    const userId = await requireUserId(ctx);
    const project = await ctx.db.get(projectId);

    if (!project || project.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "That hustle does not exist." });
    }

    return await enqueue(ctx, projectId, rebuild);
  },
});

/**
 * What the build screen watches.
 *
 * Convex pushes this to every open tab whenever a lead changes, which is what
 * makes the screen a window onto the run rather than a picture of it — the
 * same reason the sweep is watchable. No polling, no socket to keep alive.
 *
 * Deliberately not the whole lead list. A patch is hundreds of businesses and
 * the screen shows a handful: the ones being built right now, and the ones
 * that just finished. Sending five hundred rows so that six can be displayed
 * would push the rest of the payload out of the browser's way for nothing.
 */
export const feed = query({
  args: { projectId: v.id("projects"), take: v.optional(v.number()) },
  returns: v.object({
    building: v.array(
      v.object({
        _id: v.id("leads"),
        name: v.string(),
        trade: v.string(),
        score: v.number(),
        startedAt: v.optional(v.number()),
      }),
    ),
    recent: v.array(
      v.object({
        _id: v.id("leads"),
        name: v.string(),
        trade: v.string(),
        url: v.string(),
        template: v.string(),
        publishedAt: v.number(),
        phone: v.optional(v.string()),
        rating: v.optional(v.number()),
        reviewCount: v.optional(v.number()),
        score: v.number(),
        build: v.optional(buildRecord),
      }),
    ),
    failed: v.array(
      v.object({
        _id: v.id("leads"),
        name: v.string(),
        error: v.optional(v.string()),
      }),
    ),
    counts: v.object({
      queued: v.number(),
      building: v.number(),
      live: v.number(),
      failed: v.number(),
      targets: v.number(),
    }),
  }),
  handler: async (ctx, { projectId, take }) => {
    const empty = {
      building: [],
      recent: [],
      failed: [],
      counts: { queued: 0, building: 0, live: 0, failed: 0, targets: 0 },
    };

    const userId = await requireUserId(ctx);
    const project = await ctx.db.get(projectId);

    if (!project || project.userId !== userId) return empty;

    const leads = await ctx.db
      .query("leads")
      .withIndex("by_project_target_and_score", (q) =>
        q.eq("projectId", projectId).eq("target", true),
      )
      .collect();

    const limit = Math.min(Math.max(take ?? 6, 1), 24);
    const count = (status: string) =>
      leads.filter((lead) => lead.siteStatus === status).length;

    return {
      building: leads
        .filter((lead) => lead.siteStatus === "building")
        .map((lead) => ({
          _id: lead._id,
          name: lead.name,
          trade: lead.categories[0] ?? "Local business",
          score: lead.score,
          startedAt: lead.siteStartedAt,
        })),

      // Newest first: the screen is a feed, and the interesting end of a feed
      // is the end that just moved.
      recent: leads
        .filter((lead) => lead.siteStatus === "live" && lead.site)
        .sort((a, b) => (b.site?.publishedAt ?? 0) - (a.site?.publishedAt ?? 0))
        .slice(0, limit)
        .map((lead) => ({
          _id: lead._id,
          name: lead.name,
          trade: lead.categories[0] ?? "Local business",
          url: lead.site?.url ?? "",
          template: lead.site?.template ?? "",
          publishedAt: lead.site?.publishedAt ?? 0,
          phone: lead.phone,
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          score: lead.score,
          build: lead.site?.build,
        })),

      failed: leads
        .filter((lead) => lead.siteStatus === "failed")
        .slice(0, limit)
        .map((lead) => ({ _id: lead._id, name: lead.name, error: lead.siteError })),

      counts: {
        queued: count("queued"),
        building: count("building"),
        live: count("live"),
        failed: count("failed"),
        targets: leads.length,
      },
    };
  },
});
