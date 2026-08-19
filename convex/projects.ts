import { v, ConvexError } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { areaValidator } from "./schema";
import { requireUserId, requireOwnedProject } from "./lib/auth";

import { taken } from "./sites";

// Long enough for "Ravenscroft Family Dentistry, Leeds", short enough that the
// name still fits on a hustle card without truncating to nothing.
export const NAME_MIN = 2;
export const NAME_MAX = 60;

// Mirrored in src/modules/hustles/area.ts, which the slider reads. Tighter
// than a street is not a search; wider than this stops being one town, and
// place searches cap out at 50 km anyway.
export const RADIUS_MIN_M = 500;
export const RADIUS_MAX_M = 25_000;

// Enough for a hand-traced outline once thinned; past this it is a scribble
// eating document budget.
export const POLYGON_MAX_POINTS = 200;

// Long enough for "Chapel Allerton, Leeds, England, United Kingdom".
const AREA_LABEL_MAX = 160;

const projectShape = v.object({
  _id: v.id("projects"),
  _creationTime: v.number(),
  userId: v.string(),
  name: v.string(),
  updatedAt: v.number(),
  area: v.optional(areaValidator),
  bench: v.optional(v.object({ id: v.string(), provider: v.string() })),
});

/** One project, if it belongs to the caller. */
export const get = query({
  args: { projectId: v.id("projects") },
  returns: projectShape,
  handler: async (ctx, { projectId }) => {
    const { project } = await requireOwnedProject(ctx, projectId);
    return project;
  },
});

/**
 * The caller's projects, newest activity first.
 *
 * Bounded with `.take()` rather than `.collect()` — a Convex function can
 * only read ~16k documents, and an unbounded read is a bug that only shows
 * up once someone is successful enough to hit it.
 */
export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(projectShape),
  handler: async (ctx, { limit }) => {
    const userId = await requireUserId(ctx);

    return await ctx.db
      .query("projects")
      .withIndex("by_user_and_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 100);
  },
});

/**
 * Checks an area came from a real map interaction rather than a hand-written
 * call. `v.number()` accepts NaN and Infinity, and a bad point here would
 * only surface much later as an empty or absurd lead search.
 */
const cleanArea = (area: {
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
  polygon?: { lat: number; lng: number }[];
}) => {
  const onEarth = (point: { lat: number; lng: number }) =>
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180;

  const reject = () => {
    throw new ConvexError({
      code: "INVALID_AREA",
      message: "That area is not somewhere we can search.",
    });
  };

  if (
    !onEarth(area) ||
    !Number.isFinite(area.radiusM) ||
    area.radiusM < RADIUS_MIN_M ||
    area.radiusM > RADIUS_MAX_M
  ) {
    reject();
  }

  // A drawn outline is user input like any other: it is capped so one scribble
  // cannot bloat the document, and every vertex has to be a real place.
  if (area.polygon !== undefined) {
    if (
      area.polygon.length < 3 ||
      area.polygon.length > POLYGON_MAX_POINTS ||
      !area.polygon.every(onEarth)
    ) {
      reject();
    }
  }

  return {
    label: area.label.trim().slice(0, AREA_LABEL_MAX),
    lat: area.lat,
    lng: area.lng,
    radiusM: Math.round(area.radiusM),
    ...(area.polygon === undefined
      ? {}
      : { polygon: area.polygon.map(({ lat, lng }) => ({ lat, lng })) }),
  };
};

/**
 * Create an empty, named project — the end of the new-hustle wizard.
 *
 * No credit is spent and no message is written: naming a hustle and picking
 * where it hunts is not a generation. The credit comes off in `messages.send`
 * when the first prompt actually starts a build, so someone who sets a hustle
 * up and walks away has not paid for anything.
 *
 * That leaves a project with zero messages, which `messages.list` and the
 * project view both already handle — a draft looks like a fresh conversation.
 */
export const createDraft = mutation({
  args: { name: v.string(), area: v.optional(areaValidator) },
  returns: v.id("projects"),
  handler: async (ctx, { name, area }) => {
    const userId = await requireUserId(ctx);

    // Trimmed and re-checked here rather than trusting the client's zod: the
    // mutation is a public endpoint and callable without the form.
    const trimmed = name.trim();

    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
      throw new ConvexError({
        code: "INVALID_NAME",
        message: `A name has to be ${NAME_MIN} to ${NAME_MAX} characters.`,
      });
    }

    return await ctx.db.insert("projects", {
      userId,
      name: trimmed,
      updatedAt: Date.now(),
      ...(area === undefined ? {} : { area: cleanArea(area) }),
    });
  },
});

/**
 * Start a project from the first prompt.
 *
 * Returns the new project id so the caller can both navigate to it and hand
 * it to Inngest. The agent run itself is NOT started here: mutations are
 * deterministic transactions and cannot make network calls, so the Next.js
 * route sends the Inngest event after this resolves.
 */
export const create = mutation({
  args: { name: v.string(), value: v.string() },
  returns: v.id("projects"),
  handler: async (ctx, { name, value }) => {
    const userId = await requireUserId(ctx);

    // Free, deliberately. This used to take a credit, from back when a project
    // *was* a build — one prompt in, one site out. It is now an empty canvas
    // with a patch to draw on it, and charging for that taxes the act of
    // starting, which is the last thing worth taxing. The sweep and the builds
    // it leads to are where the money is; see src/lib/pricing.ts.
    const projectId = await ctx.db.insert("projects", {
      userId,
      name,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("messages", {
      projectId,
      content: value,
      role: "USER",
      type: "RESULT",
    });

    return projectId;
  },
});

/**
 * Delete a project and everything under it.
 *
 * Postgres did this with `onDelete: Cascade`. Convex has no cascade, so the
 * children have to be walked explicitly — miss this and every deleted
 * project leaves orphaned messages and fragments behind forever.
 */
export const remove = mutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, { projectId }) => {
    await requireOwnedProject(ctx, projectId);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    for (const message of messages) {
      const fragment = await ctx.db
        .query("fragments")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .unique();

      if (fragment !== null) await ctx.db.delete(fragment._id);
      await ctx.db.delete(message._id);
    }

    // Discovery's rows hang off the project too, and there are far more of
    // them than messages — a swept patch is hundreds of leads. Left behind
    // they are unreachable forever: every read of them starts from a project
    // id that no longer resolves.
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    for (const lead of leads) await ctx.db.delete(lead._id);

    const hunts = await ctx.db
      .query("hunts")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    // A sweep still in flight stops on its own once its row is gone: both
    // `sweep` and `absorb` read the hunt first and return when it is missing,
    // so the next scheduled step spends nothing and writes nothing.
    for (const hunt of hunts) await ctx.db.delete(hunt._id);

    await ctx.db.delete(projectId);
    return null;
  },
});

/**
 * Claims the address this project's site will be published at.
 *
 * Called by the build, through the HTTP door in convex/http.ts, the first time
 * a site compiles. Not called again after that: the first branch is the point
 * of the whole function. A project that already has a slug keeps it, whatever
 * it is now called and however many times it is rebuilt, because the slug has
 * been in a client's inbox since the day it was claimed.
 *
 * The caller sends a short list of names in order of preference rather than
 * one, because a collision is resolved by asking again and each ask is a round
 * trip. `slugCandidates` in src/publish/slug.ts builds the list; the second
 * entry carries a tag derived from the project id, so the loop below is
 * expected to end on the first or second try and the list is not a search.
 */
export const claimSite = internalMutation({
  args: {
    projectId: v.id("projects"),
    candidates: v.array(v.string()),
    // Passed in rather than read from a Convex environment variable, so the
    // domain is configured in exactly one place — the .env the build runs
    // with — instead of two that can disagree.
    domain: v.string(),
  },
  returns: v.object({ slug: v.string(), url: v.string() }),
  handler: async (ctx, { projectId, candidates, domain }) => {
    const project = await ctx.db.get(projectId);

    if (!project) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "That hustle no longer exists.",
      });
    }

    if (project.site) {
      return { slug: project.site.slug, url: project.site.url };
    }

    for (const slug of candidates) {
      // Both tables, not just this one: leads publish under the same domain.
      // See convex/sites.ts.
      if (await taken(ctx, slug)) continue;

      const url = `https://${slug}.${domain}`;
      await ctx.db.patch(projectId, { site: { slug, url } });

      return { slug, url };
    }

    // Both candidates taken means two projects share a name *and* an id hash,
    // which is a bug rather than a busy afternoon. Loud, because silently
    // publishing over somebody else's site is the alternative.
    throw new ConvexError({
      code: "SLUG_UNAVAILABLE",
      message: `No address is free for this hustle (tried ${candidates.join(", ")}).`,
    });
  },
});

/**
 * What the build needs to know about the project it is building.
 *
 * Only the name, today, which is what the published subdomain is derived from.
 * Internal: read by the Inngest job through convex/http.ts, which has no user
 * session to check ownership against and carries the shared secret instead.
 */
export const basicsForAgent = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.union(v.object({ name: v.string() }), v.null()),
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get(projectId);
    return project ? { name: project.name } : null;
  },
});
