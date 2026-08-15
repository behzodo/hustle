import { v, ConvexError } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { messageRole, messageType } from "./schema";
import { requireUserId, requireOwnedProject } from "./lib/auth";
import { consumeCredit } from "./credits";

// A Convex document is capped at 1 MiB. Checked a little under that so the
// error names the real cause instead of surfacing as a platform rejection
// after a 30-minute build has already finished.
const MAX_FILES_BYTES = 900_000;

const fragmentShape = v.object({
  _id: v.id("fragments"),
  _creationTime: v.number(),
  messageId: v.id("messages"),
  sandboxUrl: v.string(),
  title: v.string(),
  files: v.record(v.string(), v.string()),
});

/**
 * Every message in a project, oldest first, each with its fragment attached.
 *
 * This is the query that replaces the 2-second poll. It is reactive: when the
 * agent writes a message, Convex re-runs this for every subscriber and the UI
 * updates. No refetchInterval, no invalidation.
 *
 * The fragments are loaded server-side in one pass rather than left for the
 * client to chase per message — that would be a request waterfall, and the
 * old include: { fragment: true } didn't have one either.
 */
export const list = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      content: v.string(),
      role: messageRole,
      type: messageType,
      fragment: v.union(fragmentShape, v.null()),
    }),
  ),
  handler: async (ctx, { projectId }) => {
    // Ownership check first: without it any signed-in user could read any
    // project's messages by guessing an id.
    await requireOwnedProject(ctx, projectId);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("asc")
      .take(500);

    const fragments = await Promise.all(
      messages.map((message) =>
        ctx.db
          .query("fragments")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .unique(),
      ),
    );

    return messages.map((message, index) => ({
      ...message,
      fragment: fragments[index],
    }));
  },
});

/** Send a follow-up prompt into an existing project. */
export const send = mutation({
  args: { projectId: v.id("projects"), value: v.string() },
  returns: v.id("messages"),
  handler: async (ctx, { projectId, value }) => {
    const { userId } = await requireOwnedProject(ctx, projectId);

    await consumeCredit(ctx, userId);

    const messageId = await ctx.db.insert("messages", {
      projectId,
      content: value,
      role: "USER",
      type: "RESULT",
    });

    // Keeps the project at the top of the sidebar, the way Prisma's
    // @updatedAt did implicitly on every write.
    await ctx.db.patch(projectId, { updatedAt: Date.now() });

    return messageId;
  },
});

/**
 * Persist an agent run's result.
 *
 * Internal on purpose: this is called by the Inngest job, never by a browser.
 * A public version would let anyone forge assistant messages into any
 * project. Inngest authenticates with the deploy key when it calls this.
 */
export const recordResult = internalMutation({
  args: {
    projectId: v.id("projects"),
    content: v.string(),
    type: messageType,
    fragment: v.optional(
      v.object({
        sandboxUrl: v.string(),
        title: v.string(),
        files: v.record(v.string(), v.string()),
      }),
    ),
  },
  returns: v.id("messages"),
  handler: async (ctx, { projectId, content, type, fragment }) => {
    if (fragment !== undefined) {
      const bytes = new TextEncoder().encode(JSON.stringify(fragment.files)).length;

      if (bytes > MAX_FILES_BYTES) {
        throw new ConvexError({
          code: "FRAGMENT_TOO_LARGE",
          message:
            `Generated files are ${Math.round(bytes / 1024)} KiB, over the ` +
            `${Math.round(MAX_FILES_BYTES / 1024)} KiB document budget. ` +
            "Move fragments.files to ctx.storage.",
        });
      }
    }

    const messageId = await ctx.db.insert("messages", {
      projectId,
      content,
      role: "ASSISTANT",
      type,
    });

    if (fragment !== undefined) {
      await ctx.db.insert("fragments", { messageId, ...fragment });
    }

    await ctx.db.patch(projectId, { updatedAt: Date.now() });

    return messageId;
  },
});

/**
 * The last few messages of a project, for the agent's memory window.
 *
 * Internal: called by the Inngest job to rebuild conversation context.
 */
export const recentForAgent = internalQuery({
  args: { projectId: v.id("projects"), take: v.optional(v.number()) },
  returns: v.array(v.object({ content: v.string(), role: messageRole })),
  handler: async (ctx, { projectId, take }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(take ?? 5);

    return messages
      .reverse()
      .map(({ content, role }) => ({ content, role }));
  },
});

export { requireUserId };
