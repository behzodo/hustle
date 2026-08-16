import { v, ConvexError } from "convex/values";

import { mutation } from "./_generated/server";
import { requireUserId } from "./lib/auth";

export const feedbackKind = v.union(
  v.literal("idea"),
  v.literal("bug"),
  v.literal("praise"),
  v.literal("other"),
);

/** Longer than anyone writes in a textarea, short enough to bound the row. */
const MAX_LENGTH = 4000;

export const submit = mutation({
  args: {
    kind: feedbackKind,
    message: v.string(),
    email: v.optional(v.string()),
  },
  returns: v.id("feedback"),
  handler: async (ctx, { kind, message, email }) => {
    const userId = await requireUserId(ctx);

    const trimmed = message.trim();

    // Validated here rather than only in the form: a mutation is a public
    // endpoint, and the client is not the only thing that can call it.
    if (trimmed.length === 0) {
      throw new ConvexError({
        code: "EMPTY_FEEDBACK",
        message: "Write something first",
      });
    }

    if (trimmed.length > MAX_LENGTH) {
      throw new ConvexError({
        code: "FEEDBACK_TOO_LONG",
        message: "That is longer than we can store",
      });
    }

    return await ctx.db.insert("feedback", {
      userId,
      kind,
      message: trimmed,
      email,
    });
  },
});
