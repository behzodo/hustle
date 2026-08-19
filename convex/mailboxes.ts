import { v, ConvexError } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireUserId } from "./lib/auth";

/**
 * Who may send, how much, and whose turn it is.
 *
 * The send queue in src/pitch-queue.ts already refuses to go faster than a
 * person plausibly types — forty seconds between messages, jittered. This is
 * the other half of that promise, and it is the half a queue cannot keep on
 * its own: a gap between messages says nothing about how many went out today,
 * and it is the daily number that decides whether a mailbox survives its first
 * month.
 *
 * Two rules, both enforced here rather than in the worker, because a worker is
 * a process that can be run twice.
 *
 * A mailbox has a ceiling for the day, and it moves. A brand-new sending
 * domain that opens at forty a day is a domain that is filtered by week two;
 * one that opens at five and climbs is one that still lands in an inbox in
 * month six. See capFor.
 *
 * And the work spreads. Four mailboxes at thirty is a hundred and twenty
 * pitches a day, but only if the fourth one is used as often as the first —
 * so a slot is always taken from whichever has waited longest, and taking it
 * is a mutation so that two workers asking at once cannot be handed the same
 * one.
 */

/** The most any single mailbox sends in a day, however old and warm it is. */
const MAX_DAILY = 40;

/**
 * How many mailboxes one reply poll will look at, per sending state.
 *
 * A bound rather than a limit anybody should hit: it exists so a table that
 * has grown to thousands of rows cannot turn a once-a-minute cron into a
 * once-a-minute full read. If this is ever reached the poll is silently
 * skipping mailboxes, so it is the number to raise — or to replace with a
 * cursor — before the user count that reaches it.
 */
const POLL_MAX = 200;

/**
 * The ramp, in days since warming started.
 *
 * Taken from what the deliverability guidance converges on rather than
 * invented: open at five, climb over four to six weeks, and never run a new
 * domain at full volume. The steps are deliberately coarse — a smooth curve
 * would be a nicer graph and the same email either way.
 *
 * A pre-warmed mailbox skips all of this. That is what the price buys, and
 * without it the honest onboarding message is "come back in a month".
 */
const RAMP: { afterDays: number; cap: number }[] = [
  { afterDays: 0, cap: 5 },
  { afterDays: 7, cap: 10 },
  { afterDays: 14, cap: 20 },
  { afterDays: 21, cap: 30 },
  { afterDays: 28, cap: MAX_DAILY },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-08-19", in UTC. The reset is a calendar event, not an elapsed hour. */
export const dayStampAt = (now: number) => new Date(now).toISOString().slice(0, 10);

/**
 * What this mailbox may send today.
 *
 * Exported so the connections screen can show the same number the queue will
 * enforce. A user watching a run stop at eleven needs to be told it was the
 * cap and not a crash.
 */
export const capFor = (mailbox: Doc<"mailboxes">, now: number): number => {
  if (mailbox.status !== "active" && mailbox.status !== "warming") return 0;

  if (mailbox.preWarmed) return MAX_DAILY;

  const days = Math.floor((now - (mailbox.warmedFrom ?? now)) / DAY_MS);

  let cap = RAMP[0].cap;
  for (const step of RAMP) if (days >= step.afterDays) cap = step.cap;

  return cap;
};

/** Today's remaining allowance, once the day roll-over is taken into account. */
const remainingFor = (mailbox: Doc<"mailboxes">, now: number) => {
  const used = mailbox.dayStamp === dayStampAt(now) ? mailbox.sentToday : 0;
  return Math.max(0, capFor(mailbox, now) - used);
};

const statusValidator = v.union(
  v.literal("provisioning"),
  v.literal("warming"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("failed"),
);

const providerValidator = v.union(v.literal("gmail"), v.literal("infraforge"));

export const credentialsValidator = v.object({
  user: v.string(),
  password: v.string(),
  smtpHost: v.optional(v.string()),
  smtpPort: v.optional(v.number()),
  imapHost: v.optional(v.string()),
  imapPort: v.optional(v.number()),
});

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The user's mailboxes, as a screen gets them.
 *
 * Credentials are not in the returns validator and must never be. A Convex
 * `returns` validator is exact, so this is not a convention that can be
 * forgotten — adding the field to the document does not add it here, and
 * returning it without declaring it throws.
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("mailboxes"),
      provider: providerValidator,
      email: v.string(),
      name: v.optional(v.string()),
      domain: v.optional(v.string()),
      status: statusValidator,
      preWarmed: v.boolean(),
      /** Today's ceiling, and what is left of it. */
      dailyCap: v.number(),
      remaining: v.number(),
      error: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    const rows = await ctx.db
      .query("mailboxes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return rows.map((mailbox) => ({
      _id: mailbox._id,
      provider: mailbox.provider,
      email: mailbox.email,
      name: mailbox.name,
      domain: mailbox.domain,
      status: mailbox.status,
      preWarmed: mailbox.preWarmed,
      dailyCap: capFor(mailbox, now),
      remaining: remainingFor(mailbox, now),
      error: mailbox.error,
    }));
  },
});

/**
 * How much this user can send today, across everything they own.
 *
 * The number the pitch screen needs before it offers to send four hundred
 * emails: a queue that silently stops at ninety looks broken, and one that
 * says "ninety today, the rest tomorrow" is a schedule.
 */
export const capacity = query({
  args: {},
  returns: v.object({
    mailboxes: v.number(),
    sendable: v.number(),
    remainingToday: v.number(),
  }),
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const now = Date.now();

    const rows = await ctx.db
      .query("mailboxes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const sendable = rows.filter((mailbox) => capFor(mailbox, now) > 0);

    return {
      mailboxes: rows.length,
      sendable: sendable.length,
      remainingToday: sendable.reduce(
        (total, mailbox) => total + remainingFor(mailbox, now),
        0,
      ),
    };
  },
});

/* -------------------------------------------------------------------------- */
/* The rotation                                                                */
/* -------------------------------------------------------------------------- */

/** Exported so convex/pitches.ts can declare the same shape it hands back. */
export const senderShape = v.object({
  mailboxId: v.id("mailboxes"),
  provider: providerValidator,
  email: v.string(),
  name: v.optional(v.string()),
  connectionId: v.optional(v.string()),
  credentials: v.optional(credentialsValidator),
});

const senderFrom = (mailbox: Doc<"mailboxes">) => ({
  mailboxId: mailbox._id,
  provider: mailbox.provider,
  email: mailbox.email,
  name: mailbox.name,
  connectionId: mailbox.connectionId,
  credentials: mailbox.credentials,
});

/**
 * Everything needed to send as this mailbox, credentials included.
 *
 * Derived from the function rather than declared beside it, so the two cannot
 * disagree — this shape is returned across an HTTP bridge and a field that
 * exists in one and not the other fails at the far end, in a worker, mid-send.
 */
export type Sender = ReturnType<typeof senderFrom>;

/**
 * Claims one send from whichever mailbox has waited longest.
 *
 * A mutation, not a query, and the claim is the point. Two workers asking at
 * the same moment must not be handed the same mailbox and the same remaining
 * slot — that is how a cap of thirty becomes a send of thirty-one, which is
 * exactly the kind of overshoot that has no visible symptom until an account
 * is throttled.
 *
 * The counter is incremented before the email is sent rather than after,
 * because the failure that matters is a worker dying mid-send. Counting first
 * loses one slot from the day's allowance; counting last would let a crash
 * loop send without limit.
 */
export const claimSendSlot = async (
  ctx: MutationCtx,
  userId: string,
): Promise<Sender | null> => {
  const now = Date.now();
  const stamp = dayStampAt(now);

  // Both sending states, each off the index. A single status column cannot
  // express "either of these two" in a range, and the alternative — reading
  // every row for the user and filtering — is the scan this avoids.
  const rows = [
    ...(await ctx.db
      .query("mailboxes")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", userId).eq("status", "active"),
      )
      .collect()),
    ...(await ctx.db
      .query("mailboxes")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", userId).eq("status", "warming"),
      )
      .collect()),
  ];

  const picked = rows
    .filter((mailbox) => remainingFor(mailbox, now) > 0)
    // Longest-waiting first. `lastSentAt` absent means never used, which
    // should go before anything that has been.
    .sort((a, b) => (a.lastSentAt ?? 0) - (b.lastSentAt ?? 0))[0];

  if (!picked) return null;

  await ctx.db.patch(picked._id, {
    // The roll-over happens here rather than on a schedule, so a mailbox
    // that was not touched for a week still starts today at zero.
    sentToday: picked.dayStamp === stamp ? picked.sentToday + 1 : 1,
    dayStamp: stamp,
    lastSentAt: now,
    updatedAt: now,
  });

  return senderFrom(picked);
};

/**
 * The same claim, callable across the HTTP bridge.
 *
 * A thin wrapper because convex/pitches.ts claims a slot inside its own
 * mutation — one transaction covering both the pitch and the mailbox, so a
 * crash between them cannot spend an allowance on a pitch that stayed queued —
 * and a mutation cannot call another mutation. The plain function above is the
 * shared one; this exists for callers that only have the API.
 */
export const takeSendSlot = internalMutation({
  args: { userId: v.string() },
  returns: v.union(senderShape, v.null()),
  handler: async (ctx, { userId }) => await claimSendSlot(ctx, userId),
});

/**
 * The mailbox a conversation belongs to, for reading replies.
 *
 * A reply has to be read by the mailbox that sent the pitch — it is the only
 * one the message is in — so this is by id rather than by rotation.
 */
export const senderFor = internalQuery({
  args: { mailboxId: v.id("mailboxes") },
  returns: v.union(senderShape, v.null()),
  handler: async (ctx, { mailboxId }) => {
    const mailbox = await ctx.db.get(mailboxId);
    return mailbox ? senderFrom(mailbox) : null;
  },
});

/**
 * Every mailbox that could hold an unread reply, for the minute-by-minute poll.
 *
 * Unscoped, because the cron does not know which users have anything waiting
 * until it looks — the same reason pitches has a status-only index.
 */
export const openMailboxes = internalQuery({
  args: {},
  returns: v.array(senderShape),
  handler: async (ctx) => {
    // Off the index and bounded, because this runs once a minute forever. A
    // `.collect()` over the whole table would read every mailbox every user
    // has ever provisioned, sixty times an hour, to find the handful that
    // might have a reply in them.
    const rows = [
      ...(await ctx.db
        .query("mailboxes")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .take(POLL_MAX)),
      ...(await ctx.db
        .query("mailboxes")
        .withIndex("by_status", (q) => q.eq("status", "warming"))
        .take(POLL_MAX)),
    ];

    return rows.map(senderFrom);
  },
});

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Records a mailbox that has just been provisioned.
 *
 * Internal: the caller is the Next route that talked to Infraforge, holding
 * the shared secret. Nothing in a browser may write a row that carries a
 * password.
 */
export const record = internalMutation({
  args: {
    userId: v.string(),
    provider: providerValidator,
    email: v.string(),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
    connectionId: v.optional(v.string()),
    externalId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    credentials: v.optional(credentialsValidator),
    preWarmed: v.boolean(),
    status: statusValidator,
  },
  returns: v.id("mailboxes"),
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("mailboxes")
      .withIndex("by_user_and_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email),
      )
      .first();

    if (existing) {
      // The counters are deliberately not reset. A credentials refresh is the
      // same inbox with a new password, and zeroing its day would hand it a
      // second full allowance — which is one way to send eighty from a mailbox
      // rated for forty.
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("mailboxes", {
      ...args,
      warmedFrom: args.preWarmed ? undefined : now,
      sentToday: 0,
      dayStamp: dayStampAt(now),
      updatedAt: now,
    });
  },
});

/** Moves a mailbox between states — verified, paused by the user, or broken. */
export const setStatus = internalMutation({
  args: {
    mailboxId: v.id("mailboxes"),
    status: statusValidator,
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { mailboxId, status, error }) => {
    await ctx.db.patch(mailboxId, {
      status,
      // Cleared on the way back to working, so a mailbox that recovered does
      // not keep showing the reason it once stopped.
      error: error?.slice(0, 300),
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Gives every already-connected Google account a row in this table.
 *
 * The send path now asks the rotation rather than the profile, and a user who
 * connected Gmail last week has nothing in the rotation to find — so without
 * this their queue stops on the day this ships, with "no mailbox to send
 * from" against a screen that plainly shows one connected.
 *
 * Idempotent, by the same `by_user_and_email` lookup `record` uses, so it is
 * safe to run again — and it should be run again, because a user can still
 * connect a Google account after this has already run once.
 *
 * `preWarmed` is true for these. It is not a claim about Google's
 * infrastructure; it is the statement that this address has been sending real
 * mail as a real person for years, and putting it on a five-a-day beginner's
 * ramp would be a downgrade dressed as caution.
 */
export const backfillFromProfiles = internalMutation({
  args: {},
  returns: v.object({ created: v.number(), skipped: v.number() }),
  handler: async (ctx) => {
    const profiles = await ctx.db.query("profiles").take(1000);
    const now = Date.now();

    let created = 0;
    let skipped = 0;

    for (const profile of profiles) {
      if (!profile.gmailConnectionId || !profile.gmailEmail) {
        skipped += 1;
        continue;
      }

      const existing = await ctx.db
        .query("mailboxes")
        .withIndex("by_user_and_email", (q) =>
          q.eq("userId", profile.userId).eq("email", profile.gmailEmail!),
        )
        .first();

      if (existing) {
        skipped += 1;
        continue;
      }

      await ctx.db.insert("mailboxes", {
        userId: profile.userId,
        provider: "gmail",
        email: profile.gmailEmail,
        name: profile.tradingName,
        connectionId: profile.gmailConnectionId,
        preWarmed: true,
        status: "active",
        sentToday: 0,
        dayStamp: dayStampAt(now),
        updatedAt: now,
      });

      created += 1;
    }

    return { created, skipped };
  },
});

/**
 * Turns a mailbox off, or back on.
 *
 * The one write a user makes directly, so it is a public mutation and checks
 * ownership. Everything else about a mailbox is written by the server.
 */
export const pause = mutation({
  args: { mailboxId: v.id("mailboxes"), paused: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { mailboxId, paused }) => {
    const userId = await requireUserId(ctx);
    const mailbox = await ctx.db.get(mailboxId);

    if (!mailbox || mailbox.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Mailbox not found" });
    }

    if (mailbox.status === "provisioning" || mailbox.status === "failed") {
      throw new ConvexError({
        code: "NOT_READY",
        message: "That mailbox is not working yet.",
      });
    }

    await ctx.db.patch(mailboxId, {
      // Back to warming rather than active: a mailbox that sat idle for a
      // fortnight has lost the rhythm its reputation was built on, and the
      // ramp is the cheapest way to pick it up again.
      status: paused ? "paused" : mailbox.preWarmed ? "active" : "warming",
      updatedAt: Date.now(),
    });

    return null;
  },
});
