import { v, ConvexError } from "convex/values";

import { internalMutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import {
  CREDIT_COSTS,
  FREE_CREDITS,
  entitlementFromToken,
  type Chargeable,
  type Entitlement,
} from "./lib/pricing";

/**
 * Credits: what a plan gives, what a pack adds, and what the work takes.
 *
 * The old version was one call to a rate limiter. It counted "generations",
 * charged for two things nobody does any more — creating a project, sending a
 * chat message — and had nowhere to put a credit somebody had paid for. This
 * is a ledger instead: a meter row per user, an append-only history beside it,
 * and a `spend` that every step of the pipeline goes through.
 *
 * Three rules the rest of the file is built around.
 *
 * The allowance is spent before the packs. A monthly grant expires and a
 * purchase does not, so spending them the other way round would quietly burn
 * something the user owns while something free sat next to it.
 *
 * The period rolls in whole months from where it started, never from now. A
 * user who does nothing for six weeks should find their reset date where they
 * left it, not moved to the day they happened to come back.
 *
 * And the allowance is never taken from a client. Clerk owns what is owed, and
 * the only way that reaches here is `setPlan` below, relayed by our own server
 * behind the shared secret — because Clerk will not put a billing claim into
 * the JWT template Convex verifies, and so the token cannot answer the one
 * question this file most needs answered.
 */

const DAY = 24 * 60 * 60 * 1000;

/**
 * How long a grant lasts.
 *
 * Thirty days rather than a calendar month, kept from the setup this replaces.
 * A calendar month would need a timezone to be meaningful and would make
 * February a worse deal than March for no reason either party cares about.
 */
export const PERIOD = 30 * DAY;

export { CREDIT_COSTS };

/** What a caller has to spend, and when the plan half of it comes back. */
export interface Balance {
  /** Everything spendable: what is left of the plan, plus purchased credits. */
  total: number;
  /** The plan's share, this period. */
  allowance: number;
  used: number;
  /** Purchased. Does not reset. */
  packs: number;
  plan: string;
  periodStart: number;
  /** Milliseconds until the allowance is restored. */
  msBeforeReset: number;
}

/**
 * What the meter reads right now, without writing anything.
 *
 * Pure, and separate from the row it describes, because a query may not
 * mutate: the balance shown on screen has to account for a period that has
 * rolled over and a plan that has been upgraded even though nothing has
 * written those facts down yet. `commit` below persists the same calculation
 * when a mutation is doing the asking.
 */
const project = (
  row: Doc<"credits"> | null,
  entitlement: Entitlement,
  now: number,
): Balance => {
  // Never billed before. The first read is a full allowance.
  if (row === null) {
    return {
      total: entitlement.credits,
      allowance: entitlement.credits,
      used: 0,
      packs: 0,
      plan: entitlement.slug,
      periodStart: now,
      msBeforeReset: PERIOD,
    };
  }

  const elapsed = now - row.periodStart;
  const lapsed = elapsed >= PERIOD;

  // Whole periods forward, so the anniversary never drifts. A row untouched
  // for ninety days lands on the start of the current period, not on today.
  const periodStart = lapsed
    ? row.periodStart + Math.floor(elapsed / PERIOD) * PERIOD
    : row.periodStart;

  const used = lapsed ? 0 : row.used;

  /**
   * A new period takes the entitlement exactly — including downwards.
   *
   * Within a period the larger of the two wins instead, so an upgrade works in
   * the second it is paid for: raising the ceiling without touching `used`
   * lets somebody who ran out carry straight on. A downgrade is not applied
   * backwards for the same reason in reverse — that month was paid for.
   *
   * The two rules have to be separate. Taking the maximum on a lapsed period
   * as well would make a single month of Max permanent: `row.allowance` would
   * stay at four thousand forever, and cancelling the plan would cost nothing.
   */
  const allowance = lapsed
    ? entitlement.credits
    : Math.max(row.allowance, entitlement.credits);

  return {
    total: Math.max(0, allowance - used) + row.packs,
    allowance,
    used,
    packs: row.packs,
    plan: lapsed ? entitlement.slug : row.plan,
    periodStart,
    msBeforeReset: Math.max(0, periodStart + PERIOD - now),
  };
};

/** Writes back what `project` worked out, creating the row on first use. */
const commit = async (
  ctx: MutationCtx,
  userId: string,
  row: Doc<"credits"> | null,
  next: Balance,
): Promise<Id<"credits">> => {
  const fields = {
    plan: next.plan,
    allowance: next.allowance,
    used: next.used,
    periodStart: next.periodStart,
    packs: next.packs,
  };

  if (row === null) return await ctx.db.insert("credits", { userId, ...fields });

  await ctx.db.patch(row._id, fields);
  return row._id;
};

const rowFor = async (ctx: QueryCtx | MutationCtx, userId: string) =>
  await ctx.db
    .query("credits")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

/**
 * What plan to price this call against.
 *
 * The row, nearly always — and that is deliberate rather than a shortcut.
 *
 * The token cannot answer. Clerk will not put its billing claims into a custom
 * JWT template, so a signed-in user's token says nothing about what they pay,
 * and reading free out of that silence is how every subscriber ends up on the
 * free allowance. The row is where the answer actually lives: `setPlan` stamps
 * it there from Next.js, which can ask Clerk directly.
 *
 * The row is also the only thing available on the paths that have no user at
 * all — a site charged from the build queue on Inngest, a pack credited from a
 * Stripe webhook. One source for both is one less thing to keep in step.
 *
 * The token still wins when it does carry features, because a signed claim
 * beats a cached one and cannot be stale. Nothing sets that up today; see
 * entitlementFromToken.
 *
 * A user with no row is free. The lowest tier, so nothing here can ever mint
 * more than the cheapest plan on its own.
 */
const entitlementIn = async (
  ctx: QueryCtx | MutationCtx,
  row: Doc<"credits"> | null,
): Promise<Entitlement> => {
  const signed = entitlementFromToken(await ctx.auth.getUserIdentity());

  if (signed !== null) return signed;

  return { slug: row?.plan ?? "free", credits: row?.allowance ?? FREE_CREDITS };
};

/** The caller's balance, read-only. Used by both the query and `spend`. */
export const readBalance = async (
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<Balance> => {
  const row = await rowFor(ctx, userId);
  return project(row, await entitlementIn(ctx, row), Date.now());
};

/* -------------------------------------------------------------------------- *
 * Spending
 * -------------------------------------------------------------------------- */

export interface SpendOptions {
  /** Overrides the price list. For charging n sites in one go, not for discounts. */
  units?: number;
  projectId?: Id<"projects">;
  /** Shown in the history — a business name, a patch label. */
  note?: string;
}

/**
 * Takes credits for one action, or refuses.
 *
 * Throws `OUT_OF_CREDITS` rather than returning false, because every caller
 * would otherwise have to remember to check — and the one that forgot would be
 * the one giving the work away. A throw inside a Convex mutation rolls the
 * whole transaction back, so a refused sweep leaves no half-written hunt.
 *
 * The cost is looked up here from the kind. It is never passed in: a caller
 * that can name its own price is a caller that can name zero.
 */
export const spend = async (
  ctx: MutationCtx,
  userId: string,
  kind: Chargeable,
  options: SpendOptions = {},
): Promise<Balance> => {
  const units = Math.max(1, Math.floor(options.units ?? 1));
  const cost = CREDIT_COSTS[kind] * units;

  const row = await rowFor(ctx, userId);
  const current = project(row, await entitlementIn(ctx, row), Date.now());

  if (current.total < cost) {
    throw new ConvexError({
      code: "OUT_OF_CREDITS",
      message: "You do not have enough credits for that.",
      needed: cost,
      balance: current.total,
      retryAfter: current.msBeforeReset,
    });
  }

  // The plan first, then the packs — the expiring half before the half that
  // keeps. `fromAllowance` can be zero, which is the normal case for somebody
  // working through a topped-up month.
  const remainingAllowance = Math.max(0, current.allowance - current.used);
  const fromAllowance = Math.min(cost, remainingAllowance);
  const fromPacks = cost - fromAllowance;

  const next: Balance = {
    ...current,
    used: current.used + fromAllowance,
    packs: current.packs - fromPacks,
    total: current.total - cost,
  };

  await commit(ctx, userId, row, next);

  await ctx.db.insert("creditLedger", {
    userId,
    kind,
    amount: -cost,
    balance: next.total,
    ...(options.projectId === undefined ? {} : { projectId: options.projectId }),
    ...(options.note === undefined ? {} : { note: options.note.slice(0, 200) }),
  });

  return next;
};

/**
 * Whether an action can be afforded, without taking anything.
 *
 * For the screens that need to grey a button out. Never a substitute for
 * `spend` — the check and the charge are two moments and four workers can
 * arrive between them.
 */
export const canAfford = async (
  ctx: QueryCtx | MutationCtx,
  userId: string,
  kind: Chargeable,
  units = 1,
) => {
  const balance = await readBalance(ctx, userId);
  return balance.total >= CREDIT_COSTS[kind] * Math.max(1, Math.floor(units));
};

/**
 * Gives credits back.
 *
 * Only for work that was charged and then did not happen — a sweep that died
 * on its first search, a build the queue claimed twice. Refunds land in the
 * packs half rather than back onto `used`, so a refund issued after a period
 * rolls over is still worth something.
 */
export const refund = async (
  ctx: MutationCtx,
  userId: string,
  amount: number,
  note?: string,
) => {
  const credits = Math.max(0, Math.floor(amount));
  if (credits === 0) return;

  const row = await rowFor(ctx, userId);
  const current = project(row, await entitlementIn(ctx, row), Date.now());

  const next: Balance = {
    ...current,
    packs: current.packs + credits,
    total: current.total + credits,
  };

  await commit(ctx, userId, row, next);

  await ctx.db.insert("creditLedger", {
    userId,
    kind: "refund",
    amount: credits,
    balance: next.total,
    ...(note === undefined ? {} : { note: note.slice(0, 200) }),
  });
};

/* -------------------------------------------------------------------------- *
 * Plans
 * -------------------------------------------------------------------------- */

/**
 * Stamps the caller's plan onto their meter.
 *
 * This exists because the obvious route does not work. Convex only ever sees
 * a JWT, so the plan has to travel in one — and Clerk refuses to put its
 * billing claims (`fea`, `pla`) into a custom JWT template, which is exactly
 * what the "convex" template is. Nor does Clerk Billing write anything to
 * `public_metadata` for a template to read. The claim this used to look for
 * was never going to arrive, which is why every paying account read as free.
 *
 * So the plan comes the other way. Next.js *can* ask Clerk — `auth().has()`
 * works there — and pushes the answer through the same shared-secret door the
 * Inngest jobs use. That door is server-only, which is what makes this safe:
 * the number is Clerk's answer relayed by our own server, not a client's
 * claim about itself.
 *
 * Called on every workspace load. Cheap and idempotent: when nothing has
 * changed it patches a row to the values it already holds.
 */
export const setPlan = internalMutation({
  args: {
    userId: v.string(),
    /** Our tier slug — "free", "starter", "pro", "max". */
    plan: v.string(),
    credits: v.number(),
  },
  returns: v.object({ plan: v.string(), allowance: v.number(), total: v.number() }),
  handler: async (ctx, { userId, plan, credits }) => {
    // Bounded here as well as at the caller. This is the function that decides
    // what somebody is owed, and it does not take a magnitude on trust.
    const allowance = Math.floor(credits);

    if (!Number.isFinite(allowance) || allowance < 0 || allowance > 100_000) {
      throw new ConvexError({ code: "BAD_PLAN", message: "That is not a plan size." });
    }

    const row = await rowFor(ctx, userId);
    const now = Date.now();

    // Deliberately not `entitlementIn`. That reads the token, and the token is
    // the thing that cannot answer this question — the whole reason this
    // mutation exists. What Next.js just told us *is* the entitlement.
    const current = project(row, { slug: plan, credits: allowance }, now);

    await commit(ctx, userId, row, current);

    // Only worth a ledger line when the plan actually moved. This runs on
    // every page load, and a history of four hundred "still on Pro" rows is a
    // history nobody can read.
    if (row !== null && row.plan !== plan) {
      await ctx.db.insert("creditLedger", {
        userId,
        kind: "grant",
        // Not a credit movement. `project` has already worked out what the
        // change does to the balance; this row is the note explaining why.
        amount: 0,
        balance: current.total,
        note: `Plan changed: ${row.plan} → ${plan}`,
      });
    }

    return { plan: current.plan, allowance: current.allowance, total: current.total };
  },
});

/* -------------------------------------------------------------------------- *
 * Buying
 * -------------------------------------------------------------------------- */

/**
 * Credits a paid pack.
 *
 * Internal, and called only from the Stripe webhook behind the shared secret —
 * this is the one function in the app that creates value out of nothing, so
 * nothing client-reachable may call it.
 *
 * Idempotent on `reference`, which is the Stripe checkout session id. Stripe
 * delivers a webhook more than once as a matter of routine, and the second
 * delivery of a purchase is not a second purchase.
 */
export const creditPack = internalMutation({
  args: {
    userId: v.string(),
    credits: v.number(),
    /** The Stripe checkout session id. What makes this safe to redeliver. */
    reference: v.string(),
  },
  returns: v.object({ credited: v.boolean(), balance: v.number() }),
  handler: async (ctx, { userId, credits, reference }) => {
    // Bounded here rather than trusted from the caller. The webhook resolves a
    // pack slug to a number on the Next side, but this is the door money comes
    // through and it checks its own inputs.
    const amount = Math.floor(credits);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
      throw new ConvexError({ code: "BAD_PACK", message: "That is not a pack size." });
    }

    const already = await ctx.db
      .query("creditLedger")
      .withIndex("by_reference", (q) => q.eq("userId", userId).eq("note", reference))
      .first();

    const row = await rowFor(ctx, userId);
    const current = project(row, await entitlementIn(ctx, row), Date.now());

    if (already !== null) {
      // Already credited. Report the balance as it stands rather than as it
      // was, so a redelivery does not read like it moved anything.
      return { credited: false, balance: current.total };
    }

    const next: Balance = {
      ...current,
      packs: current.packs + amount,
      total: current.total + amount,
    };

    await commit(ctx, userId, row, next);

    await ctx.db.insert("creditLedger", {
      userId,
      kind: "pack",
      amount,
      balance: next.total,
      note: reference,
    });

    return { credited: true, balance: next.total };
  },
});

/* -------------------------------------------------------------------------- *
 * Reading
 * -------------------------------------------------------------------------- */

const balanceShape = v.object({
  total: v.number(),
  allowance: v.number(),
  used: v.number(),
  packs: v.number(),
  plan: v.string(),
  periodStart: v.number(),
  msBeforeReset: v.number(),
});

/**
 * The signed-in user's balance.
 *
 * Reactive: spending a credit updates every open tab on its own, which is why
 * the sweep screen can show the meter moving as a patch is worked.
 *
 * Returns null rather than throwing for signed-out visitors — the pricing page
 * is public and renders this.
 */
export const balance = query({
  args: {},
  returns: v.union(balanceShape, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;

    return await readBalance(ctx, identity.subject);
  },
});

/**
 * What the credits went on, most recent first.
 *
 * The answer to "where did my month go", which a balance on its own cannot
 * give. Capped rather than paged: nobody scrolls a ledger, they look at the
 * last screenful and then at the total.
 */
export const history = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("creditLedger"),
      _creationTime: v.number(),
      kind: v.string(),
      amount: v.number(),
      balance: v.number(),
      projectId: v.optional(v.id("projects")),
      note: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { limit }) => {
    const userId = await requireUserId(ctx);
    const take = Math.min(200, Math.max(1, Math.floor(limit ?? 50)));

    const rows = await ctx.db
      .query("creditLedger")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(take);

    return rows.map(({ _id, _creationTime, kind, amount, balance, projectId, note }) => ({
      _id,
      _creationTime,
      kind,
      amount,
      balance,
      ...(projectId === undefined ? {} : { projectId }),
      ...(note === undefined ? {} : { note }),
    }));
  },
});

/**
 * The shape the old `<Usage />` and stat tiles read.
 *
 * Kept so the screens that only ever wanted "how many left, and when does it
 * come back" did not all have to change on the same day this landed. New
 * callers should use `balance` — it can tell a purchased credit from a granted
 * one, and this cannot.
 */
export const status = query({
  args: {},
  returns: v.union(
    v.object({ remainingPoints: v.number(), msBeforeNext: v.number() }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;

    const current = await readBalance(ctx, identity.subject);

    return {
      remainingPoints: current.total,
      msBeforeNext: current.msBeforeReset,
    };
  },
});
