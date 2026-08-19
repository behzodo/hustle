import "server-only";

import {
  fetchOpenPitches,
  fetchPitchContext,
  fetchPitchTargets,
  queueProjectPitches,
  recordLeadEmail,
  recordPitchReply,
  recordPitchSent,
  saveLeadPitch,
  takeNextPitch,
} from "@/inngest/convex";
import { findEmail, readReply, readThread, sendMail, writePitch } from "@/pitch";
import { writeAnswer } from "@/pitch/answer";
import { closeIfAgreed } from "@/pay/close";
import { appendPitchMessage } from "@/inngest/convex";

/**
 * Working through a hustle's outreach.
 *
 * Two runs, deliberately separate, because they are limited by opposite
 * things and joining them would make each one wait for the other's ceiling.
 *
 * Drafting is model work. It looks like the build queue — a small pool of
 * workers against the same three free tiers — and it is fast: a few seconds a
 * business, several at a time.
 *
 * Sending is not, and this is the part worth reading before changing. Gmail
 * will accept a few hundred messages a day and will accept them as fast as
 * they are offered. What it will not do is protect the account from the
 * consequences. Four hundred cold emails from a personal address inside an
 * hour is the exact signature of a compromised mailbox, and the outcomes are
 * a sending limit, a spam folder every subsequent email lands in, or a
 * suspended account — the user's real one, with their real mail in it.
 *
 * So the send loop is one worker with a gap between messages, and a daily
 * ceiling well under what Google would technically allow. It is slower than
 * the machine can go on purpose. Nothing else in this codebase is.
 */

/** Drafting workers. Same shape and same reasoning as the build queue's three. */
export const DRAFT_WORKERS = 3;

/**
 * The gap between two sent emails, in milliseconds.
 *
 * Forty seconds, jittered, which works out at around ninety an hour. Not a
 * measured limit — it is a judgement about what a person plausibly sends, and
 * the whole point is to look like one. Raising it is free; lowering it spends
 * somebody's actual email account.
 */
const SEND_GAP_MS = 40_000;

/**
 * How many go out in one run.
 *
 * Fifty. A free Gmail account is cut off at around five hundred a day and a
 * Workspace one at two thousand, so this is a tenth of the floor — the number
 * is not about the quota, it is about the first week of a sending address's
 * life, when a reputation is being established and a bad one is very hard to
 * undo.
 */
const SEND_CAP = 50;

export interface DraftedPitch {
  leadId: string;
  name: string;
  to: string;
  subject: string;
  blocked: boolean;
  problems: string[];
  tokens: number;
  seconds: number;
}

export interface SkippedLead {
  leadId: string;
  name: string;
  why: string;
}

export interface DraftResult {
  drafted: DraftedPitch[];
  /** Businesses with a site and no way to reach anybody. The honest number. */
  unreachable: SkippedLead[];
  failed: SkippedLead[];
  seconds: number;
}

/**
 * Writes a pitch for every built business that has none.
 *
 * Nothing is sent. Every one of these lands in the inbox as a draft, which is
 * the only sane default for a thing that emails strangers under somebody
 * else's name — the first run over a real patch is exactly when a person
 * should read four of them before four hundred people do.
 */
export const draftPitches = async (
  projectId: string,
  options: {
    workers?: number;
    limit?: number;
    events?: {
      onDrafted?: (pitch: DraftedPitch) => void;
      onSkipped?: (lead: SkippedLead) => void;
    };
  } = {},
): Promise<DraftResult> => {
  const started = Date.now();
  const { leads } = await fetchPitchTargets(projectId, options.limit);

  const drafted: DraftedPitch[] = [];
  const unreachable: SkippedLead[] = [];
  const failed: SkippedLead[] = [];
  const events = options.events ?? {};

  // A plain shared cursor rather than a Convex claim. Drafting is idempotent
  // — worst case two workers write the same business's draft twice and the
  // second overwrites the first — so the claim the send queue needs would be
  // ceremony here.
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const lead = leads[cursor++];
      if (!lead) return;

      try {
        const { lead: context } = await fetchPitchContext(lead.leadId);

        if (!context) {
          failed.push({ leadId: lead.leadId, name: lead.name, why: "No site built yet" });
          continue;
        }

        if (context.pitched) continue;

        if (!context.sender.tradingName) {
          failed.push({
            leadId: lead.leadId,
            name: lead.name,
            why: "Finish onboarding first — a pitch has to be signed by somebody",
          });
          continue;
        }

        // The address. Looked for once ever per business: `emailCheckedAt`
        // records the attempt, so a patch where most have none does not pay
        // for the same few hundred fetches on every run.
        let email = context.email;

        if (!email && context.emailCheckedAt === undefined) {
          const found = await findEmail({
            website: context.website,
            presence: context.presence,
          });

          email = found?.email;
          await recordLeadEmail({
            leadId: lead.leadId,
            email: found?.email,
            source: found?.source,
          });
        }

        if (!email) {
          const skip = {
            leadId: lead.leadId,
            name: lead.name,
            why: "No email address anywhere — needs one typed in, or a phone call",
          };

          unreachable.push(skip);
          events.onSkipped?.(skip);
          continue;
        }

        const at = Date.now();

        const composed = await writePitch(
          {
            name: context.name,
            trade: context.trade,
            town: context.town,
            categories: context.categories,
            siteUrl: context.siteUrl,
          },
          context.sender,
        );

        const seconds = Math.round(((Date.now() - at) / 1000) * 10) / 10;
        const problems = composed.problems.map((p) => `${p.severity}: ${p.message}`);

        await saveLeadPitch({
          leadId: lead.leadId,
          to: email,
          subject: composed.subject,
          body: composed.body,
          blocked: composed.blocked,
          write: {
            provider: composed.provider,
            tokens: composed.tokens,
            seconds,
            rewrites: composed.rewrites,
            problems,
          },
        });

        const record = {
          leadId: lead.leadId,
          name: lead.name,
          to: email,
          subject: composed.subject,
          blocked: composed.blocked,
          problems,
          tokens: composed.tokens,
          seconds,
        };

        drafted.push(record);
        events.onDrafted?.(record);
      } catch (cause) {
        const record = { leadId: lead.leadId, name: lead.name, why: String(cause) };

        failed.push(record);
        events.onSkipped?.(record);
      }
    }
  };

  await Promise.all(
    Array.from({ length: options.workers ?? DRAFT_WORKERS }, () => worker()),
  );

  return {
    drafted,
    unreachable,
    failed,
    seconds: (Date.now() - started) / 1000,
  };
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface SendResult {
  queued: number;
  sent: { pitchId: string; business: string; to: string }[];
  failed: { pitchId: string; business: string; error: string }[];
  /** True when the run stopped because it hit the cap rather than the bottom. */
  capped: boolean;
  seconds: number;
}

/**
 * Sends what has been queued, slowly.
 *
 * One at a time and one message per gap. There is no worker pool here and
 * adding one would defeat the point: the constraint is not throughput, it is
 * that the account this sends from belongs to a person who needs it to keep
 * working tomorrow.
 */
export const sendPitches = async (
  projectId: string,
  options: {
    cap?: number;
    gapMs?: number;
    events?: {
      onSent?: (sent: { pitchId: string; business: string; to: string }) => void;
      onFailed?: (failed: { pitchId: string; business: string; error: string }) => void;
    };
  } = {},
): Promise<SendResult> => {
  const started = Date.now();
  const { queued } = await queueProjectPitches(projectId);

  const cap = options.cap ?? SEND_CAP;
  const gap = options.gapMs ?? SEND_GAP_MS;
  const events = options.events ?? {};

  const sent: SendResult["sent"] = [];
  const failed: SendResult["failed"] = [];
  let capped = false;

  for (;;) {
    if (sent.length >= cap) {
      capped = true;
      break;
    }

    const { next } = await takeNextPitch(projectId);
    if (!next) break;

    try {
      const result = await sendMail(next.connectionId, {
        to: next.to,
        subject: next.subject,
        body: next.body,
        from: { email: next.from },
      });

      await recordPitchSent({ pitchId: next.pitchId, gmail: result });

      const record = { pitchId: next.pitchId, business: next.business, to: next.to };
      sent.push(record);
      events.onSent?.(record);
    } catch (cause) {
      const error = String(cause);

      // Recorded before moving on, so the pitch leaves "sending" — a status it
      // would otherwise hold until the staleness check took it back, looking
      // to the screen like an email in flight.
      await recordPitchSent({ pitchId: next.pitchId, error }).catch(() => {});

      const record = { pitchId: next.pitchId, business: next.business, error };
      failed.push(record);
      events.onFailed?.(record);
    }

    // Jittered, because a message every forty seconds to the millisecond is a
    // pattern, and a pattern is the thing being avoided. Only between sends —
    // no point waiting after the last one.
    await pause(gap + Math.floor(Math.random() * gap * 0.5));
  }

  return { queued, sent, failed, capped, seconds: (Date.now() - started) / 1000 };
};

export interface ReplyResult {
  checked: number;
  replies: { pitchId: string; verdict: string; gist: string }[];
}

/**
 * Looks for answers to everything still open.
 *
 * Polling rather than a Gmail push subscription, which needs a Pub/Sub topic
 * and a verified domain and is the right answer later. What makes polling
 * cheap enough in the meantime is `known`: a thread whose message count has
 * not moved is skipped before anything is read, so a hundred open pitches
 * costs a hundred small reads and nothing else.
 */
export const checkReplies = async (
  projectId: string,
  connectionId: string,
  us: string,
): Promise<ReplyResult> => {
  const { open } = await fetchOpenPitches(projectId);
  const replies: ReplyResult["replies"] = [];

  for (const pitch of open) {
    let messages;

    try {
      messages = await readThread(connectionId, pitch.threadId, us);
    } catch {
      // A thread the user deleted, or a connection that has gone. Neither is
      // worth failing the whole sweep for.
      continue;
    }

    if (messages.length <= pitch.known) continue;

    const theirs = messages.filter((m) => m.theirs);
    if (theirs.length === 0) continue;

    const latest = theirs[theirs.length - 1];
    const reading = await readReply(latest.text);

    const thread = messages.map((m) => ({
      side: m.theirs ? ("them" as const) : ("us" as const),
      text: m.text,
      at: m.at,
    }));

    await recordPitchReply({
      pitchId: pitch.pitchId,
      messages: thread,
      verdict: reading.verdict,
      gist: reading.gist,
    });

    replies.push({
      pitchId: pitch.pitchId,
      verdict: reading.verdict,
      gist: reading.gist,
    });

    // And answer it, in the same pass. The whole point of polling every minute
    // rather than when somebody presses a button is that the business gets a
    // reply while they are still thinking about it.
    if (!pitch.business || !pitch.siteUrl || !pitch.sender) continue;

    // Raised before the reply is written, so the answer can say the invoice is
    // on its way and be telling the truth when it does.
    const closed = await closeIfAgreed({
      pitchId: pitch.pitchId,
      verdict: reading.verdict,
      business: pitch.business,
      siteUrl: pitch.siteUrl,
      to: pitch.to,
      invoiced: pitch.invoiced,
      sender: pitch.sender,
    }).catch((cause) => {
      console.error(`[pitch] could not invoice ${pitch.business}:`, cause);
      return null;
    });

    const answer = await writeAnswer({
      verdict: reading.verdict,
      thread,
      business: pitch.business,
      siteUrl: pitch.siteUrl,
      sender: pitch.sender,
    });

    // Nothing to say, or something the checker refused. Both leave the reply
    // filed and waiting for a person, which is the safe end of the trade: an
    // answer that is late can be fixed and one that is wrong cannot.
    if (!answer || answer.blocked) continue;

    try {
      await sendMail(connectionId, {
        to: pitch.to,
        subject: pitch.subject.startsWith("Re:") ? pitch.subject : `Re: ${pitch.subject}`,
        body: closed ? [answer.body, closed.line].join("\n\n") : answer.body,
        from: { email: us },
        replyTo: { threadId: pitch.threadId, rfcId: pitch.rfcId },
      });

      await appendPitchMessage({
        pitchId: pitch.pitchId,
        side: "us",
        text: answer.body,
      });
    } catch (cause) {
      console.error(`[pitch] could not answer ${pitch.business}:`, cause);
    }
  }

  return { checked: open.length, replies };
};
