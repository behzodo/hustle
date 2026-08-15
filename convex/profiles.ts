import { v, ConvexError } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";

const profileShape = v.object({
  _id: v.id("profiles"),
  _creationTime: v.number(),
  userId: v.string(),
  tradingName: v.string(),
  experience: v.string(),
  city: v.string(),
  industries: v.array(v.string()),
  priceBand: v.string(),
  tone: v.string(),
  gmailConnectionId: v.optional(v.string()),
  gmailEmail: v.optional(v.string()),
  stripeAccountId: v.optional(v.string()),
});

/** The saved profile, or null when the wizard has not been completed. */
export const status = query({
  args: {},
  returns: v.union(profileShape, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;

    return await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .unique();
  },
});

/**
 * Save the onboarding answers.
 *
 * Upsert, not insert: re-running the wizard to change a patch or price band
 * should update the profile. Prisma expressed this as `upsert` against the
 * unique userId; here it is an explicit lookup-then-patch-or-insert, which
 * is safe because the whole mutation is one transaction.
 */
export const save = mutation({
  args: {
    tradingName: v.string(),
    experience: v.string(),
    city: v.string(),
    industries: v.array(v.string()),
    priceBand: v.string(),
    tone: v.string(),
  },
  returns: v.id("profiles"),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert("profiles", { userId, ...args });
  },
});

/**
 * Save the connections screen.
 *
 * Separate from `save` because these are optional and set later — folding
 * them into the onboarding mutation would force the wizard to send fields
 * it never collects.
 */
export const setConnections = mutation({
  args: {
    gmailConnectionId: v.optional(v.string()),
    gmailEmail: v.optional(v.string()),
    stripeAccountId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Finish onboarding first",
      });
    }

    await ctx.db.patch(existing._id, args);
    return null;
  },
});
