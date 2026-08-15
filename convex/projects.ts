import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireUserId, requireOwnedProject } from "./lib/auth";
import { consumeCredit } from "./credits";

const projectShape = v.object({
  _id: v.id("projects"),
  _creationTime: v.number(),
  userId: v.string(),
  name: v.string(),
  updatedAt: v.number(),
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
