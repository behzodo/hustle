import { v, ConvexError } from "convex/values";
import { RateLimiter } from "@convex-dev/rate-limiter";

import { components } from "./_generated/api";
import { query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { creditsForIdentity } from "./lib/entitlements";

// Credits, formerly the `Usage` table driven by RateLimiterPrisma.
//
// rate-limiter-flexible has no Convex store, so the component replaces it.
// The semantics are kept identical to the old setup: one credit per
// generation, a 30-day window, allowance set by the caller's plan.
//
// "fixed window" matches the old behaviour — the whole allowance returns at
// once when the period rolls over, rather than trickling back continuously
// the way a token bucket would.
const DAY = 24 * 60 * 60 * 1000;
const PERIOD = 30 * DAY;

export const GENERATION_COST = 1;

const limiter = new RateLimiter(components.rateLimiter);

const configFor = (allowance: number) =>
  ({ kind: "fixed window", rate: allowance, period: PERIOD }) as const;

/**
 * Spend one credit, or throw the error the UI turns into an upgrade prompt.
 *
 * Takes the ctx rather than an allowance so the plan is always read from the
 * verified token — see lib/entitlements.ts for why that must not be an arg.
 */
export async function consumeCredit(ctx: MutationCtx, userId: string) {
  const allowance = creditsForIdentity(await ctx.auth.getUserIdentity());

  const status = await limiter.limit(ctx, "generation", {
    key: userId,
    count: GENERATION_COST,
    config: configFor(allowance),
  });

  if (!status.ok) {
    throw new ConvexError({
      code: "OUT_OF_CREDITS",
      message: "You have run out of credits",
      retryAfter: status.retryAfter,
    });
  }
}

/** Remaining credits and when they reset, without spending anything. */
export async function readCredits(
  ctx: QueryCtx | MutationCtx,
  userId: string,
  allowance: number,
) {
  const value = await limiter.getValue(ctx, "generation", {
    key: userId,
    config: configFor(allowance),
  });

  return {
    // Same shape rate-limiter-flexible returned, so <Usage /> renders
    // unchanged.
    remainingPoints: Math.max(0, Math.floor(value.value)),
    msBeforeNext: Math.max(0, value.ts + PERIOD - Date.now()),
  };
}

/**
 * Credit status for the signed-in user.
 *
 * Reactive: spending a credit updates every open tab's counter on its own.
 * The tRPC version needed an explicit `queryClient.invalidateQueries` after
 * each mutation to fake this, and still showed a stale number until it ran.
 */
export const status = query({
  args: {},
  returns: v.union(
    v.object({ remainingPoints: v.number(), msBeforeNext: v.number() }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    // Signed-out visitors get null rather than an error — the old procedure
    // swallowed its own throw to do exactly this.
    if (identity === null) return null;

    return await readCredits(ctx, identity.subject, creditsForIdentity(identity));
  },
});
