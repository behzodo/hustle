import { v, ConvexError } from "convex/values";

import { mutation, query } from "./_generated/server";
import { areaValidator } from "./schema";
import { requireUserId, requireOwnedProject } from "./lib/auth";
import { consumeCredit } from "./credits";

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

    // Before the insert, so a caller who is out of credits never gets a
    // half-created project. The whole mutation rolls back on throw.
    await consumeCredit(ctx, userId);

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

    await ctx.db.delete(projectId);
    return null;
  },
});
