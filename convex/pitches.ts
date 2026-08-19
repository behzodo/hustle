import { v, ConvexError } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireOwnedProject, requireUserId } from "./lib/auth";
import { spend } from "./credits";
import { claimSendSlot, credentialsValidator, senderShape } from "./mailboxes";
import { pitchStatus } from "./schema";

/**
 * A mailbox, as the reply poller needs one.
 *
 * `senderShape` without the id, because reading a conversation does not need
 * to know which row it came from — and because a pitch sent before mailboxes
 * existed has no row to name, only a Gmail connection on the profile. Keeping
 * the id out is what lets both answer the same question.
 */
const readerShape = v.object({
  provider: v.union(v.literal("gmail"), v.literal("infraforge")),
  email: v.string(),
  name: v.optional(v.string()),
  connectionId: v.optional(v.string()),
  credentials: v.optional(credentialsValidator),
});

/**
 * The pitch lane, from the database's side.
 *
 * Mirrors convex/sites.ts in shape — enqueue, claim, record — and differs from
 * it in one way that matters. A site build is idempotent: run it twice and the
 * second run overwrites the first at the same address, and nobody is harmed.
 * Sending is not. A pitch sent twice is a stranger emailed twice by somebody
 * they never asked to hear from once.
 *
 * So every claim here is narrower than the build lane's. `takeNext` will only
 * ever hand back a pitch that is `queued`, the write that claims it is the
 * same mutation that reads it, and `recordSent` refuses a pitch that already
 * has a Gmail id. Three separate places where a duplicate has to get past a
 * check, because the failure is not recoverable.
 */

/**
 * How long a send may sit claimed before the queue takes it back.
 *
 * Much shorter than a build's fifteen minutes, because the work behind the
 * claim is one HTTP call rather than four seconds of model time. Two minutes
 * is far longer than Gmail has ever taken to answer and short enough that a
 * killed worker does not strand a pitch for the rest of the afternoon.
 */
const STALE_SEND_MS = 2 * 60 * 1000;

const stale = (pitch: Doc<"pitches">, now: number) =>
  pitch.status === "sending" && now - (pitch.startedAt ?? 0) > STALE_SEND_MS;

/** Everything the inbox draws a row from. Exact, as a returns validator must be. */
const pitchShape = v.object({
  _id: v.id("pitches"),
  _creationTime: v.number(),
  projectId: v.id("projects"),
  leadId: v.id("leads"),
  userId: v.string(),
  business: v.string(),
  trade: v.string(),
  siteUrl: v.string(),
  to: v.string(),
  subject: v.string(),
  body: v.string(),
  status: pitchStatus,
  gmail: v.optional(
    v.object({
      threadId: v.string(),
      messageId: v.string(),
      rfcId: v.optional(v.string()),
    }),
  ),
  invoice: v.optional(
    v.object({
      id: v.string(),
      url: v.string(),
      number: v.optional(v.string()),
      amount: v.number(),
      currency: v.string(),
      fee: v.number(),
      raisedAt: v.number(),
      paidAt: v.optional(v.number()),
    }),
  ),
  thread: v.array(
    v.object({
      side: v.union(v.literal("us"), v.literal("them")),
      text: v.string(),
      at: v.number(),
    }),
  ),
  write: v.optional(
    v.object({
      provider: v.string(),
      tokens: v.number(),
      seconds: v.number(),
      rewrites: v.number(),
      problems: v.array(v.string()),
    }),
  ),
  sentAt: v.optional(v.number()),
  startedAt: v.optional(v.number()),
  error: v.optional(v.string()),
  readAt: v.optional(v.number()),
  updatedAt: v.number(),
});

/* -------------------------------------------------------------------------- *
 * Writing one.
 * -------------------------------------------------------------------------- */

/**
 * What the writer needs to know, in one read.
 *
 * Returns null for a lead with no site, because a pitch is an email about a
 * website and there is nothing to send somebody who has not been built one
 * yet. That is a skip, not an error — a patch is always part built.
 */
export const context = internalQuery({
  args: { leadId: v.id("leads") },
  returns: v.union(
    v.object({
      name: v.string(),
      trade: v.string(),
      categories: v.array(v.string()),
      town: v.optional(v.string()),
      website: v.optional(v.string()),
      presence: v.string(),
      siteUrl: v.string(),
      projectId: v.id("projects"),
      userId: v.string(),
      email: v.optional(v.string()),
      emailCheckedAt: v.optional(v.number()),
      // The freelancer, not the business. Signs the email and sets its voice.
      sender: v.object({
        tradingName: v.string(),
        city: v.optional(v.string()),
        tone: v.optional(v.string()),
        priceBand: v.optional(v.string()),
        gmailConnectionId: v.optional(v.string()),
        gmailEmail: v.optional(v.string()),
      }),
      // Set when this business has already been written to. The queue skips
      // it rather than writing a second cold email to the same person.
      pitched: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, { leadId }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead?.site?.url) return null;

    const project = await ctx.db.get(lead.projectId);

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", lead.userId))
      .first();

    const existing = await ctx.db
      .query("pitches")
      .withIndex("by_lead", (q) => q.eq("leadId", leadId))
      .first();

    return {
      name: lead.name,
      trade: lead.categories[0] ?? "Local business",
      categories: lead.categories,
      town: project?.area?.label,
      website: lead.website,
      presence: lead.presence,
      siteUrl: lead.site.url,
      projectId: lead.projectId,
      userId: lead.userId,
      email: lead.contact?.email,
      emailCheckedAt: lead.contact?.checkedAt,
      sender: {
        // A profile is written at onboarding and is not optional in practice,
        // but the row can be absent for an account that skipped it — and an
        // email signed "undefined" is worse than one that never sends.
        tradingName: profile?.tradingName ?? "",
        city: profile?.city,
        tone: profile?.tone,
        priceBand: profile?.priceBand,
        gmailConnectionId: profile?.gmailConnectionId,
        gmailEmail: profile?.gmailEmail,
      },
      pitched: Boolean(existing),
    };
  },
});

/** Records what the email hunt found, including finding nothing. */
export const recordEmail = internalMutation({
  args: {
    leadId: v.id("leads"),
    email: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { leadId, email, source }) => {
    // `checkedAt` is set either way. A business with no published address is
    // the common case, and without a record of having looked, every run looks
    // again — a few hundred fetches to learn the same nothing.
    await ctx.db.patch(leadId, {
      contact: { email, source, checkedAt: Date.now() },
    });

    return null;
  },
});

/**
 * Stores a written pitch as a draft.
 *
 * Nothing is sent by writing. A draft sits in the inbox until somebody queues
 * it, which is deliberate: the first run of this over a real patch is the
 * moment to read a few before four hundred strangers do.
 */
export const saveDraft = internalMutation({
  args: {
    leadId: v.id("leads"),
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    blocked: v.boolean(),
    write: v.object({
      provider: v.string(),
      tokens: v.number(),
      seconds: v.number(),
      rewrites: v.number(),
      problems: v.array(v.string()),
    }),
  },
  returns: v.union(v.id("pitches"), v.null()),
  handler: async (ctx, { leadId, to, subject, body, blocked, write }) => {
    const lead = await ctx.db.get(leadId);
    if (!lead?.site?.url) return null;

    const existing = await ctx.db
      .query("pitches")
      .withIndex("by_lead", (q) => q.eq("leadId", leadId))
      .first();

    // Never over an email that has gone out. A rewrite of a sent pitch would
    // change what the screen says was sent, which is the one thing the record
    // exists to be honest about.
    if (existing && existing.status !== "drafted" && existing.status !== "failed") {
      return existing._id;
    }

    // Charged for a draft somebody can actually send, and only the first time
    // one appears.
    //
    // Three cases are deliberately free. A blocked draft is not a pitch — the
    // checker refused it and there is nothing to send — so the model call is
    // absorbed rather than billed to a user who got nothing. Re-drafting over
    // a draft that is already good is the queue being run twice, not a second
    // piece of work. And sending, later, is free: the credit was taken when
    // the words were written, which is the part that costs.
    //
    // That leaves exactly one billable event per business: the first usable
    // draft, or the one that finally works after a blocked attempt.
    const firstUsableDraft =
      !blocked && (existing === null || existing.status === "failed");

    if (firstUsableDraft) {
      await spend(ctx, lead.userId, "pitch", {
        projectId: lead.projectId,
        note: lead.name,
      });
    }

    const fields = {
      to,
      subject,
      body,
      // A blocked draft is stored, not thrown away. The refused text and the
      // reason for refusing it are both worth reading, and the alternative is
      // a business that silently never gets pitched.
      status: (blocked ? "failed" : "drafted") as Doc<"pitches">["status"],
      error: blocked ? write.problems.join("; ") : undefined,
      write,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }

    return await ctx.db.insert("pitches", {
      projectId: lead.projectId,
      leadId,
      userId: lead.userId,
      business: lead.name,
      trade: lead.categories[0] ?? "Local business",
      siteUrl: lead.site.url,
      thread: [],
      ...fields,
    });
  },
});

/**
 * Businesses with a finished site and no pitch written yet.
 *
 * The list the drafting run works through. Best score first, for the same
 * reason the build queue is: a run that stops halfway should have got through
 * the businesses most worth having.
 */
export const toDraft = internalQuery({
  args: { projectId: v.id("projects"), limit: v.optional(v.number()) },
  returns: v.array(v.object({ leadId: v.id("leads"), name: v.string(), score: v.number() })),
  handler: async (ctx, { projectId, limit }) => {
    const live = await ctx.db
      .query("leads")
      .withIndex("by_project_status_and_score", (q) =>
        q.eq("projectId", projectId).eq("siteStatus", "live"),
      )
      .order("desc")
      .take(Math.min(limit ?? 400, 800));

    const out: { leadId: Id<"leads">; name: string; score: number }[] = [];

    for (const lead of live) {
      const existing = await ctx.db
        .query("pitches")
        .withIndex("by_lead", (q) => q.eq("leadId", lead._id))
        .first();

      // Already written to, or already drafted. Redrafting a draft nobody
      // sent is fine in principle and wasteful in practice — it is a model
      // call per business to produce a different version of the same email.
      if (existing) continue;

      out.push({ leadId: lead._id, name: lead.name, score: lead.score });
    }

    return out;
  },
});

/* -------------------------------------------------------------------------- *
 * The send queue.
 * -------------------------------------------------------------------------- */

/**
 * Marks drafts as ready to go.
 *
 * Only drafts. A pitch that failed its checks stays failed until a person
 * looks at it, and one already sent is never queued again by anything — the
 * second email to a stranger is the one that makes them report it.
 */
const enqueue = async (ctx: MutationCtx, projectId: Id<"projects">) => {
  const drafts = await ctx.db
    .query("pitches")
    .withIndex("by_project_status_and_updated", (q) =>
      q.eq("projectId", projectId).eq("status", "drafted"),
    )
    .collect();

  const now = Date.now();
  let queued = 0;

  for (const pitch of drafts) {
    // Belt and braces against a status that says drafted on a row that has a
    // Gmail id. It should not happen; if it ever does, it must not send.
    if (pitch.gmail) continue;

    await ctx.db.patch(pitch._id, { status: "queued", updatedAt: now });
    queued += 1;
  }

  return { queued };
};

export const queueProject = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.object({ queued: v.number() }),
  handler: (ctx, { projectId }) => enqueue(ctx, projectId),
});

/**
 * Takes the next pitch off the queue and claims it.
 *
 * Oldest first, unlike the build queue's best-score-first. The ordering
 * question is different: a build queue is choosing what is worth doing at all,
 * where by the time something is in this queue a person has already decided it
 * should go. What is left is fairness — the one that has been waiting longest
 * goes next.
 */
export const takeNext = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.union(
    v.object({
      pitchId: v.id("pitches"),
      business: v.string(),
      to: v.string(),
      subject: v.string(),
      body: v.string(),
      sender: senderShape,
    }),
    v.null(),
  ),
  handler: async (ctx, { projectId }) => {
    const now = Date.now();

    const next = await ctx.db
      .query("pitches")
      .withIndex("by_project_status_and_updated", (q) =>
        q.eq("projectId", projectId).eq("status", "queued"),
      )
      .order("asc")
      .first();

    if (!next) {
      // Nothing queued. Before giving up, hand back anything whose claim has
      // gone stale — a worker that died mid-send leaves a row nobody will
      // ever pick up otherwise.
      const stuck = await ctx.db
        .query("pitches")
        .withIndex("by_project_status_and_updated", (q) =>
          q.eq("projectId", projectId).eq("status", "sending"),
        )
        .collect();

      for (const pitch of stuck) {
        if (stale(pitch, now)) {
          await ctx.db.patch(pitch._id, { status: "queued", updatedAt: now });
        }
      }

      return null;
    }

    // The rotation, not the profile. Claimed inside this same mutation so the
    // allowance and the pitch move together: a crash between them would
    // otherwise spend a mailbox's slot on a pitch still sitting queued, and
    // the day's ceiling would drift down every time a worker died.
    const sender = await claimSendSlot(ctx, next.userId);

    if (!sender) {
      // Two different situations, and they need different sentences. No
      // mailbox at all is a setup step; every mailbox at its ceiling is a
      // schedule, and telling somebody their queue has "failed" when it is
      // simply finished for today is how a working product reads as broken.
      const owned = await ctx.db
        .query("mailboxes")
        .withIndex("by_user", (q) => q.eq("userId", next.userId))
        .take(1);

      if (owned.length === 0) {
        await ctx.db.patch(next._id, {
          status: "failed",
          error:
            "No mailbox to send from. Add one on the connections screen, or connect a Google account.",
          updatedAt: now,
        });
      }

      // Left queued when they simply have none left today — the next run
      // picks it up, and the queue is a queue rather than a pile of failures.
      return null;
    }

    await ctx.db.patch(next._id, {
      status: "sending",
      mailboxId: sender.mailboxId,
      startedAt: now,
      updatedAt: now,
    });

    return {
      pitchId: next._id,
      business: next.business,
      to: next.to,
      subject: next.subject,
      body: next.body,
      sender,
    };
  },
});

/** Says how a send went. One shape for both outcomes so neither is forgotten. */
export const recordSent = internalMutation({
  args: {
    pitchId: v.id("pitches"),
    gmail: v.optional(
      v.object({
        threadId: v.string(),
        messageId: v.string(),
        rfcId: v.optional(v.string()),
      }),
    ),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { pitchId, gmail, error }) => {
    const pitch = await ctx.db.get(pitchId);
    if (!pitch) return null;

    const now = Date.now();

    if (!gmail) {
      await ctx.db.patch(pitchId, {
        status: "failed",
        error: error ?? "Sending failed",
        startedAt: undefined,
        updatedAt: now,
      });

      return null;
    }

    await ctx.db.patch(pitchId, {
      status: "sent",
      gmail,
      sentAt: now,
      startedAt: undefined,
      error: undefined,
      // The thread starts with what we sent. A conversation shown only from
      // the reply onwards is one nobody can judge the reply against.
      thread: [{ side: "us" as const, text: pitch.body, at: now }],
      updatedAt: now,
    });

    return null;
  },
});

/* -------------------------------------------------------------------------- *
 * The inbox.
 * -------------------------------------------------------------------------- */

/** One hustle's pitches, most recently touched first. */
export const list = query({
  args: { projectId: v.id("projects"), limit: v.optional(v.number()) },
  returns: v.array(pitchShape),
  handler: async (ctx, { projectId, limit }) => {
    await requireOwnedProject(ctx, projectId);

    return await ctx.db
      .query("pitches")
      .withIndex("by_project_and_updated", (q) => q.eq("projectId", projectId))
      .order("desc")
      .take(Math.min(limit ?? 100, 200));
  },
});

/** How the hustle's outreach is going, in five numbers. */
export const progress = query({
  args: { projectId: v.id("projects") },
  returns: v.object({
    drafted: v.number(),
    queued: v.number(),
    sent: v.number(),
    replied: v.number(),
    failed: v.number(),
    // Businesses with a live site and no email address found. The reason a
    // patch of two hundred produces forty pitches, and a number that has to be
    // on the screen or the gap looks like a bug.
    unreachable: v.number(),
    live: v.number(),
  }),
  handler: async (ctx, { projectId }) => {
    await requireOwnedProject(ctx, projectId);

    const pitches = await ctx.db
      .query("pitches")
      .withIndex("by_project_and_updated", (q) => q.eq("projectId", projectId))
      .collect();

    const count = (...want: string[]) =>
      pitches.filter((p) => want.includes(p.status)).length;

    const built = await ctx.db
      .query("leads")
      .withIndex("by_project_status_and_score", (q) =>
        q.eq("projectId", projectId).eq("siteStatus", "live"),
      )
      .collect();

    return {
      drafted: count("drafted"),
      queued: count("queued", "sending"),
      sent: count("sent"),
      replied: count("replied", "won", "lost"),
      failed: count("failed"),
      unreachable: built.filter(
        (lead) => lead.contact?.checkedAt !== undefined && !lead.contact?.email,
      ).length,
      live: built.length,
    };
  },
});

/**
 * Businesses with a finished site and nowhere to send it.
 *
 * The screen this feeds is not a report, it is a worklist. On a real patch —
 * seventy-three businesses swept in Jacksonville — seventy of them had no
 * email address published anywhere, because a Google Maps listing does not
 * carry one and a business with no website usually has no other page either.
 *
 * That is the true shape of this product's outreach and it cannot be coded
 * around, so the screen shows the phone number next to an empty field. Two
 * ways to finish the job by hand, on the businesses that are worth it.
 */
export const unreachable = query({
  args: { projectId: v.id("projects"), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("leads"),
      name: v.string(),
      trade: v.string(),
      score: v.number(),
      phone: v.optional(v.string()),
      website: v.optional(v.string()),
      siteUrl: v.string(),
    }),
  ),
  handler: async (ctx, { projectId, limit }) => {
    await requireOwnedProject(ctx, projectId);

    const live = await ctx.db
      .query("leads")
      .withIndex("by_project_status_and_score", (q) =>
        q.eq("projectId", projectId).eq("siteStatus", "live"),
      )
      .order("desc")
      .take(Math.min(limit ?? 200, 400));

    return live
      .filter((lead) => !lead.contact?.email && lead.site?.url)
      .map((lead) => ({
        _id: lead._id,
        name: lead.name,
        trade: lead.categories[0] ?? "Local business",
        score: lead.score,
        phone: lead.phone,
        website: lead.website,
        siteUrl: lead.site!.url,
      }));
  },
});

/** Marks one as read. The inbox's unread filter is the only thing that cares. */
export const markRead = mutation({
  args: { pitchId: v.id("pitches") },
  returns: v.null(),
  handler: async (ctx, { pitchId }) => {
    const userId = await requireUserId(ctx);
    const pitch = await ctx.db.get(pitchId);

    if (!pitch || pitch.userId !== userId) return null;
    if (pitch.readAt) return null;

    // `updatedAt` deliberately untouched. Reading something is not activity on
    // it, and letting it reorder the list would shuffle the inbox as somebody
    // clicks down it.
    await ctx.db.patch(pitchId, { readAt: Date.now() });

    return null;
  },
});

/**
 * Edits a draft before it goes.
 *
 * Only a draft. Once an email has been sent, what is stored is a record of
 * what was sent, and a record that can be edited afterwards is not one.
 */
export const editDraft = mutation({
  args: {
    pitchId: v.id("pitches"),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { pitchId, subject, body, to }) => {
    const userId = await requireUserId(ctx);
    const pitch = await ctx.db.get(pitchId);

    if (!pitch || pitch.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pitch not found" });
    }

    if (pitch.status !== "drafted" && pitch.status !== "failed") {
      throw new ConvexError({
        code: "SENT",
        message: "That one has already gone out. It cannot be edited.",
      });
    }

    await ctx.db.patch(pitchId, {
      ...(subject !== undefined ? { subject } : {}),
      ...(body !== undefined ? { body } : {}),
      ...(to !== undefined ? { to } : {}),
      // A person has looked at it and changed it, which clears whatever the
      // checker refused it for. Their judgement, their sending address.
      ...(pitch.status === "failed" ? { status: "drafted" as const, error: undefined } : {}),
      updatedAt: Date.now(),
    });

    return null;
  },
});

/** Types in an address the finder could not find. */
export const setEmail = mutation({
  args: { leadId: v.id("leads"), email: v.string() },
  returns: v.null(),
  handler: async (ctx, { leadId, email }) => {
    const userId = await requireUserId(ctx);
    const lead = await ctx.db.get(leadId);

    if (!lead || lead.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Business not found" });
    }

    const trimmed = email.trim().toLowerCase();

    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(trimmed)) {
      throw new ConvexError({ code: "BAD_EMAIL", message: "That is not an email address." });
    }

    await ctx.db.patch(leadId, {
      contact: { email: trimmed, source: "manual", checkedAt: Date.now() },
    });

    // A pitch already drafted to nobody now has somewhere to go.
    const pitch = await ctx.db
      .query("pitches")
      .withIndex("by_lead", (q) => q.eq("leadId", leadId))
      .first();

    if (pitch && (pitch.status === "drafted" || pitch.status === "failed")) {
      await ctx.db.patch(pitch._id, { to: trimmed, updatedAt: Date.now() });
    }

    return null;
  },
});

/**
 * One pitch, with the sender's Stripe account, for raising an invoice by hand.
 *
 * Its own query because the invoice route needs three things from two tables
 * and has to prove ownership of both — and because everything it returns is a
 * thing the automatic path already gets from `awaitingReply`. This is the same
 * answer for somebody pressing a button.
 */
export const forInvoice = query({
  args: { pitchId: v.id("pitches") },
  returns: v.union(
    v.object({
      business: v.string(),
      siteUrl: v.string(),
      to: v.string(),
      invoiced: v.boolean(),
      tradingName: v.string(),
      priceBand: v.optional(v.string()),
      stripeAccountId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, { pitchId }) => {
    const userId = await requireUserId(ctx);
    const pitch = await ctx.db.get(pitchId);

    if (!pitch || pitch.userId !== userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      business: pitch.business,
      siteUrl: pitch.siteUrl,
      to: pitch.to,
      invoiced: Boolean(pitch.invoice),
      tradingName: profile?.tradingName ?? "",
      priceBand: profile?.priceBand,
      stripeAccountId: profile?.stripeAccountId,
    };
  },
});

/** Says how it ended, when a person decides rather than a reply. */
export const setStatus = mutation({
  args: {
    pitchId: v.id("pitches"),
    status: v.union(v.literal("won"), v.literal("lost"), v.literal("sent")),
  },
  returns: v.null(),
  handler: async (ctx, { pitchId, status }) => {
    const userId = await requireUserId(ctx);
    const pitch = await ctx.db.get(pitchId);

    if (!pitch || pitch.userId !== userId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Pitch not found" });
    }

    await ctx.db.patch(pitchId, { status, updatedAt: Date.now() });

    return null;
  },
});

/* -------------------------------------------------------------------------- *
 * Replies.
 * -------------------------------------------------------------------------- */

/** Everything sent and still open, for the poller to check for answers. */
export const awaitingReply = internalQuery({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      pitchId: v.id("pitches"),
      threadId: v.string(),
      known: v.number(),
      // Everything the answer needs, so the poller does not read the row again
      // for each of a hundred open conversations.
      to: v.string(),
      subject: v.string(),
      business: v.string(),
      siteUrl: v.string(),
      rfcId: v.optional(v.string()),
      invoiced: v.boolean(),
      sender: v.object({
        tradingName: v.string(),
        city: v.optional(v.string()),
        tone: v.optional(v.string()),
        priceBand: v.optional(v.string()),
        stripeAccountId: v.optional(v.string()),
      }),
      // Which mailbox to look in. Null when there is nothing to look with —
      // an old pitch whose Gmail connection has since been removed — and the
      // poller skips those rather than failing the whole sweep for one.
      mailbox: v.union(readerShape, v.null()),
    }),
  ),
  handler: async (ctx, { projectId }) => {
    const sent = await ctx.db
      .query("pitches")
      .withIndex("by_project_status_and_updated", (q) =>
        q.eq("projectId", projectId).eq("status", "sent"),
      )
      .collect();

    const open = sent.filter((pitch) => pitch.gmail?.threadId);
    if (open.length === 0) return [];

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", open[0].userId))
      .first();

    const sender = {
      tradingName: profile?.tradingName ?? "",
      city: profile?.city,
      tone: profile?.tone,
      priceBand: profile?.priceBand,
      stripeAccountId: profile?.stripeAccountId,
    };

    /**
     * The mailbox each conversation lives in.
     *
     * Cached, because a hundred open pitches across four mailboxes is four
     * reads rather than a hundred — and this query runs once a minute for
     * every hustle with anything outstanding.
     */
    const mailboxes = new Map<string, typeof readerShape.type | null>();

    const readerFor = async (pitch: Doc<"pitches">) => {
      // The old world: sent before mailboxes existed, out of the one Gmail
      // account on the profile. Still readable, so still read.
      if (!pitch.mailboxId) {
        return profile?.gmailConnectionId && profile.gmailEmail
          ? {
              provider: "gmail" as const,
              email: profile.gmailEmail,
              connectionId: profile.gmailConnectionId,
            }
          : null;
      }

      const key = pitch.mailboxId;
      const cached = mailboxes.get(key);
      if (cached !== undefined) return cached;

      const mailbox = await ctx.db.get(pitch.mailboxId);

      const reader = mailbox
        ? {
            provider: mailbox.provider,
            email: mailbox.email,
            name: mailbox.name,
            connectionId: mailbox.connectionId,
            credentials: mailbox.credentials,
          }
        : null;

      mailboxes.set(key, reader);
      return reader;
    };

    const rows = [];

    for (const pitch of open) {
      rows.push({
        pitchId: pitch._id,
        threadId: pitch.gmail!.threadId,
        // How many messages we already know about, so the poller can tell a
        // thread that has moved from one that has not without re-reading it.
        known: pitch.thread.length,
        to: pitch.to,
        subject: pitch.subject,
        business: pitch.business,
        siteUrl: pitch.siteUrl,
        rfcId: pitch.gmail!.rfcId,
        invoiced: Boolean(pitch.invoice),
        sender,
        mailbox: await readerFor(pitch),
      });
    }

    return rows;
  },
});

/**
 * Files the invoice against the pitch that produced it.
 *
 * Refuses to overwrite one. Raising a second invoice for the same job is the
 * kind of mistake that is only discovered when a business pays both, and the
 * automatic path can be reached twice — a reply arriving while the previous
 * one is still being answered is exactly the case.
 */
export const recordInvoice = internalMutation({
  args: {
    pitchId: v.id("pitches"),
    invoice: v.object({
      id: v.string(),
      url: v.string(),
      number: v.optional(v.string()),
      amount: v.number(),
      currency: v.string(),
      fee: v.number(),
    }),
  },
  returns: v.boolean(),
  handler: async (ctx, { pitchId, invoice }) => {
    const pitch = await ctx.db.get(pitchId);
    if (!pitch) return false;
    if (pitch.invoice) return false;

    await ctx.db.patch(pitchId, {
      invoice: { ...invoice, raisedAt: Date.now() },
      // Won the moment the invoice goes out, not when it is paid. The two are
      // different questions and only one of them is this screen's.
      status: "won",
      updatedAt: Date.now(),
    });

    return true;
  },
});

/**
 * Every mailbox with a conversation still open, across every hustle.
 *
 * What the minute-by-minute poll works from. Grouped by user rather than by
 * project because the thing being polled is a Gmail account, and a user with
 * four hustles has one inbox, not four.
 */
export const openMailboxes = internalQuery({
  args: {},
  returns: v.array(
    v.object({ userId: v.string(), projectId: v.id("projects") }),
  ),
  handler: async (ctx) => {
    const open = await ctx.db
      .query("pitches")
      .withIndex("by_status_and_updated", (q) => q.eq("status", "sent"))
      .order("desc")
      .take(500);

    // Just the hustles with something outstanding. Which mailbox to read each
    // conversation in is no longer a property of the project — with a rotation
    // there are several, and the answer is per pitch — so that resolution has
    // moved into `open` below, and this is only the list of doors to knock on.
    const seen = new Set<string>();
    const out: { userId: string; projectId: Id<"projects"> }[] = [];

    for (const pitch of open) {
      const key = `${pitch.userId}:${pitch.projectId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ userId: pitch.userId, projectId: pitch.projectId });
    }

    return out;
  },
});

/** Adds one message to a thread, whichever side wrote it. */
export const appendMessage = internalMutation({
  args: {
    pitchId: v.id("pitches"),
    side: v.union(v.literal("us"), v.literal("them")),
    text: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { pitchId, side, text }) => {
    const pitch = await ctx.db.get(pitchId);
    if (!pitch) return null;

    await ctx.db.patch(pitchId, {
      thread: [...pitch.thread, { side, text, at: Date.now() }],
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Files a reply against the pitch it answers.
 *
 * `verdict` decides the status and nothing else: "keen" and "changes" are both
 * `replied`, because both mean a person wrote back and both need a human next.
 * Only "stop" and "bounced" close a pitch on their own, because both are
 * instructions rather than opinions.
 */
export const recordReply = internalMutation({
  args: {
    pitchId: v.id("pitches"),
    messages: v.array(
      v.object({
        side: v.union(v.literal("us"), v.literal("them")),
        text: v.string(),
        at: v.number(),
      }),
    ),
    verdict: v.optional(v.string()),
    gist: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { pitchId, messages, verdict, gist }) => {
    const pitch = await ctx.db.get(pitchId);
    if (!pitch) return null;

    const closed = verdict === "stop" || verdict === "bounced";
    // An automatic reply is not a reply. Left as `sent` so the poller keeps
    // watching the thread for the person behind the autoresponder.
    const nothing = verdict === "auto";

    await ctx.db.patch(pitchId, {
      thread: messages,
      status: closed ? "lost" : nothing ? pitch.status : "replied",
      error: closed ? gist : pitch.error,
      // Unread again: something happened that a person needs to see.
      readAt: nothing ? pitch.readAt : undefined,
      updatedAt: Date.now(),
    });

    return null;
  },
});
