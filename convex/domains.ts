import { v, ConvexError } from "convex/values";

import { mutation, query } from "./_generated/server";
import { domainStatus } from "./schema";
import { requireUserId } from "./lib/auth";

/**
 * The record of a domain somebody bought.
 *
 * Nothing here talks to a registrar or to Stripe — both live in the Next app,
 * because both need secrets and network calls a Convex mutation cannot make.
 * What this file owns is the part that has to be transactional: claiming a
 * name so two people cannot start buying it at once, and moving one order
 * through its states so a payment can never be spent twice.
 *
 * The states are in convex/schema.ts. The one worth keeping in mind while
 * reading this file is `paid`: past it, the customer's card has been charged,
 * and every failure from there is one that owes either a retry or a refund.
 */

/**
 * The most a single domain may be sold for, in cents.
 *
 * A bound rather than a business rule. `priceCents` arrives as an argument, and
 * a validator that only says "a number" would accept one with fourteen digits
 * in it — which would then be shown on a card and reported as revenue. The
 * shop refuses premium names well below this anyway; this is the backstop for
 * the case where the code that does that is the thing that is broken.
 */
const MAX_PRICE_CENTS = 20_000;

/** A domain, as a screen gets one. */
const domainShape = v.object({
  _id: v.id("domains"),
  _creationTime: v.number(),
  userId: v.string(),
  projectId: v.id("projects"),
  leadId: v.optional(v.id("leads")),
  domain: v.string(),
  slug: v.string(),
  status: domainStatus,
  priceCents: v.number(),
  costCents: v.optional(v.number()),
  currency: v.string(),
  sessionId: v.optional(v.string()),
  hostnameId: v.optional(v.string()),
  sslStatus: v.optional(v.string()),
  error: v.optional(v.string()),
  registeredAt: v.optional(v.number()),
  renewsAt: v.optional(v.number()),
  updatedAt: v.number(),
});

/**
 * Whether this name is already spoken for in here.
 *
 * Not a substitute for asking the registrar — somebody outside this app can
 * own it and we would never know. It answers a narrower question: has one of
 * our own users already got an order open on it? Without this, two people who
 * both search "joesgym.com" in the same minute both pay, and the second one
 * gets a refund and a bad afternoon.
 *
 * A failed or refunded order does not hold the name. That is the whole reason
 * those states exist separately from `pending`.
 */
const held = async (
  ctx: Parameters<typeof requireUserId>[0],
  domain: string,
): Promise<boolean> => {
  const existing = await ctx.db
    .query("domains")
    .withIndex("by_domain", (q) => q.eq("domain", domain))
    .collect();

  return existing.some(
    (order) => order.status === "pending" || order.status === "paid" || order.status === "live",
  );
};

/**
 * Opens an order, before the card is touched.
 *
 * Written first on purpose. A row that exists before the payment means a
 * payment that succeeds always has somewhere to land, even if the browser is
 * closed the moment after it goes through — the alternative is a charge with
 * no record of what it was for.
 */
export const start = mutation({
  args: {
    leadId: v.id("leads"),
    domain: v.string(),
    priceCents: v.number(),
    currency: v.optional(v.string()),
  },
  returns: v.id("domains"),
  handler: async (ctx, { leadId, domain, priceCents, currency }) => {
    const userId = await requireUserId(ctx);
    const lead = await ctx.db.get(leadId);

    if (lead === null || lead.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "That business is not in your hustles." });
    }

    if (!lead.site) {
      throw new ConvexError({
        code: "NO_SITE",
        message: "Build the site first — a domain needs somewhere to point.",
      });
    }

    if (lead.site.customDomain) {
      throw new ConvexError({
        code: "ALREADY_OWNED",
        message: `That business is already on ${lead.site.customDomain}.`,
      });
    }

    const name = domain.trim().toLowerCase();

    // A hostname before it is anything else, and this one is going into a
    // registrar call and a certificate request. Checked here rather than
    // trusted from the route, because this is the last place before it is
    // written down.
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z]{2,})+$/.test(name)) {
      throw new ConvexError({ code: "BAD_DOMAIN", message: `"${domain}" is not a domain.` });
    }

    if (
      !Number.isFinite(priceCents) ||
      priceCents <= 0 ||
      priceCents > MAX_PRICE_CENTS
    ) {
      throw new ConvexError({ code: "BAD_PRICE", message: "That price is not one this shop sells at." });
    }

    if (await held(ctx, name)) {
      throw new ConvexError({
        code: "TAKEN",
        message: `Somebody is already buying ${name}.`,
      });
    }

    return await ctx.db.insert("domains", {
      userId,
      projectId: lead.projectId,
      leadId,
      domain: name,
      slug: lead.site.slug,
      status: "pending",
      priceCents: Math.round(priceCents),
      currency: currency ?? "usd",
      updatedAt: Date.now(),
    });
  },
});

/** Ties the order to the payment that will pay for it. */
export const attachSession = mutation({
  args: { orderId: v.id("domains"), sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, { orderId, sessionId }) => {
    const userId = await requireUserId(ctx);
    const order = await ctx.db.get(orderId);

    if (order === null || order.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "That order does not exist." });
    }

    await ctx.db.patch(orderId, { sessionId, updatedAt: Date.now() });
    return null;
  },
});

/**
 * Claims an order for fulfilment.
 *
 * The guard that makes buying idempotent. Fulfilment runs when the buyer
 * returns from Stripe, and a return page is refreshed, opened twice, and
 * navigated back to — so the call that says "this payment went through, go and
 * buy the domain" has to be safe to make repeatedly.
 *
 * Only a `pending` order moves to `paid`. A second caller finds it already
 * there and is told `claimed: false`, which means "somebody else is buying it,
 * do nothing" rather than "something went wrong".
 */
export const claimPaid = mutation({
  args: { orderId: v.id("domains"), sessionId: v.string() },
  returns: v.object({
    claimed: v.boolean(),
    domain: v.string(),
    slug: v.string(),
    status: domainStatus,
  }),
  handler: async (ctx, { orderId, sessionId }) => {
    const userId = await requireUserId(ctx);
    const order = await ctx.db.get(orderId);

    if (order === null || order.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "That order does not exist." });
    }

    // The session has to be the one this order was opened with. Without it a
    // paid order could be pointed at a different, cheaper payment.
    if (order.sessionId !== sessionId) {
      throw new ConvexError({ code: "WRONG_SESSION", message: "That payment is for a different order." });
    }

    const shape = {
      domain: order.domain,
      slug: order.slug,
      status: order.status,
    };

    if (order.status !== "pending") return { claimed: false, ...shape };

    await ctx.db.patch(orderId, { status: "paid", updatedAt: Date.now() });

    return { claimed: true, ...shape, status: "paid" as const };
  },
});

/**
 * The domain is bought, pointed, and on the card.
 *
 * Two writes in one transaction: the order becomes `live`, and the lead learns
 * its new address. They must not be able to disagree — a card showing a domain
 * that no order backs is a link somebody sends a client.
 */
export const markLive = mutation({
  args: {
    orderId: v.id("domains"),
    costCents: v.number(),
    hostnameId: v.optional(v.string()),
    sslStatus: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { orderId, costCents, hostnameId, sslStatus }) => {
    const userId = await requireUserId(ctx);
    const order = await ctx.db.get(orderId);

    if (order === null || order.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "That order does not exist." });
    }

    const now = Date.now();

    await ctx.db.patch(orderId, {
      status: "live",
      costCents:
        Number.isFinite(costCents) && costCents >= 0
          ? Math.round(costCents)
          : undefined,
      ...(hostnameId ? { hostnameId } : {}),
      ...(sslStatus ? { sslStatus } : {}),
      error: undefined,
      registeredAt: now,
      // A year, which is what every registration here buys. Stored rather
      // than derived so a two-year term later on changes one write instead of
      // every screen that reads it.
      renewsAt: now + 365 * 24 * 60 * 60 * 1000,
      updatedAt: now,
    });

    if (order.leadId) {
      const lead = await ctx.db.get(order.leadId);

      // Merged into the existing object rather than replacing it: `site` also
      // carries the slug, the template and the build record, and none of that
      // is this mutation's to throw away.
      if (lead?.site) {
        await ctx.db.patch(order.leadId, {
          site: { ...lead.site, customDomain: order.domain },
        });
      }
    }

    return null;
  },
});

/**
 * It did not work.
 *
 * The status it lands in depends on whether money changed hands, because the
 * two need different things done about them: a `pending` order that failed
 * cost nobody anything, and a `paid` one that failed is a refund somebody is
 * waiting for. Nothing here refunds — that is the route's job, and it says so
 * by calling this with `refunded`.
 */
export const markFailed = mutation({
  args: {
    orderId: v.id("domains"),
    error: v.string(),
    refunded: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { orderId, error, refunded }) => {
    const userId = await requireUserId(ctx);
    const order = await ctx.db.get(orderId);

    if (order === null || order.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "That order does not exist." });
    }

    await ctx.db.patch(orderId, {
      status: refunded ? "refunded" : "failed",
      // Truncated: this goes on a screen, and a registrar's error body can be
      // a whole page of XML.
      error: error.slice(0, 300),
      updatedAt: Date.now(),
    });

    return null;
  },
});

/** Records that the certificate finished issuing. */
export const recordSsl = mutation({
  args: { orderId: v.id("domains"), sslStatus: v.string() },
  returns: v.null(),
  handler: async (ctx, { orderId, sslStatus }) => {
    const userId = await requireUserId(ctx);
    const order = await ctx.db.get(orderId);

    if (order === null || order.userId !== userId) return null;

    await ctx.db.patch(orderId, { sslStatus, updatedAt: Date.now() });
    return null;
  },
});

/**
 * The domain on one business's card.
 *
 * Returns the latest order rather than only a live one, because a card that
 * says nothing after a failed purchase is a card that looks like nobody ever
 * tried — and the person looking at it has been charged.
 */
export const forLead = query({
  args: { leadId: v.id("leads") },
  returns: v.union(domainShape, v.null()),
  handler: async (ctx, { leadId }) => {
    const userId = await requireUserId(ctx);

    const orders = await ctx.db
      .query("domains")
      .withIndex("by_lead", (q) => q.eq("leadId", leadId))
      .collect();

    const mine = orders.filter((order) => order.userId === userId);
    if (mine.length === 0) return null;

    // Newest first. A business that failed once and was bought a different
    // name afterwards should show the one that worked.
    return mine.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  },
});

/** Everything this user has bought. The shop's own list. */
export const mine = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(domainShape),
  handler: async (ctx, { limit }) => {
    const userId = await requireUserId(ctx);
    const take = Math.min(Math.max(Math.floor(limit ?? 100), 1), 200);

    return await ctx.db
      .query("domains")
      .withIndex("by_user_and_updated", (q) => q.eq("userId", userId))
      .order("desc")
      .take(take);
  },
});

/**
 * How long before a renewal is worth saying something about.
 *
 * Thirty days, because that is roughly when a registrar starts sending its own
 * warnings and comfortably before the grace period that follows an expiry. The
 * thing being protected is not the domain — auto-renew at the registrar
 * handles that — it is the chance to invoice the client for another year
 * before we have already paid for it.
 */
const RENEWAL_WARNING_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * What needs a human, in two numbers.
 *
 * `stuck` is the one that matters and the one the shop cannot fix on its own:
 * an order on `paid` is a card that was charged and a domain that was not
 * bought, which happens when the buyer closes the tab mid-purchase. It is
 * somebody's money sitting in a state nothing retries automatically, so it has
 * to be visible or it is invisible forever.
 *
 * Cheap enough to run on every workspace render: it reads one user's domains,
 * which is a handful of rows even for somebody who has sold a lot of them.
 */
export const attention = query({
  args: {},
  returns: v.object({ stuck: v.number(), expiring: v.number(), total: v.number() }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    // Signed out rather than an error: this drives a badge in the shell, which
    // renders during the moment before Clerk has handed over a token.
    if (identity === null) return { stuck: 0, expiring: 0, total: 0 };

    const orders = await ctx.db
      .query("domains")
      .withIndex("by_user_and_updated", (q) => q.eq("userId", identity.subject))
      .collect();

    const soon = Date.now() + RENEWAL_WARNING_MS;

    return {
      stuck: orders.filter((order) => order.status === "paid").length,
      expiring: orders.filter(
        (order) =>
          order.status === "live" &&
          order.renewsAt !== undefined &&
          order.renewsAt < soon,
      ).length,
      // Live ones only. The count beside a nav item should be what somebody
      // owns, not how many times they have tried to buy something.
      total: orders.filter((order) => order.status === "live").length,
    };
  },
});

/**
 * One order, for the page the buyer comes back to.
 *
 * Separate from `forLead` because the return route has an order id and no lead
 * — the payment knows what it paid for, not which business it was for.
 */
export const get = query({
  args: { orderId: v.id("domains") },
  returns: v.union(domainShape, v.null()),
  handler: async (ctx, { orderId }) => {
    const userId = await requireUserId(ctx);
    const order = await ctx.db.get(orderId);

    if (order === null || order.userId !== userId) return null;
    return order;
  },
});
