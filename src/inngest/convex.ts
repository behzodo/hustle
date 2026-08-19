import "server-only";

/**
 * The Inngest job's door into Convex.
 *
 * The run itself cannot live inside Convex — it drives an E2B sandbox for up
 * to 30 minutes against a 10-minute action ceiling — so it stays on Inngest
 * and calls the HTTP actions in convex/http.ts to read and write.
 *
 * Those actions are the only public entry to internal mutations that would be
 * forgeable if exposed: the shared secret is what stands in for the user's
 * identity, since there is no browser session on this side.
 */
const SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
const SECRET = process.env.AGENT_WEBHOOK_SECRET;

const call = async <T>(path: string, body: unknown): Promise<T> => {
  if (!SITE_URL || !SECRET) {
    throw new Error(
      "Agent callback is not configured. Set NEXT_PUBLIC_CONVEX_SITE_URL and " +
        "AGENT_WEBHOOK_SECRET, and `npx convex env set AGENT_WEBHOOK_SECRET`.",
    );
  }

  const res = await fetch(`${SITE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Fail loudly: Inngest retries a thrown step, and a silently dropped
    // result means a finished build nobody ever sees.
    throw new Error(`Convex ${path} failed: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as T;
};

/**
 * The last few messages of a project, for the agent's memory window, and the
 * project itself — whose name the published subdomain is derived from.
 *
 * `project` is null for a project deleted mid-run, which is rare but not
 * impossible: a build takes half an hour and the sidebar has a delete button.
 */
export const fetchAgentContext = (projectId: string, take = 5) =>
  call<{
    messages: { content: string; role: "USER" | "ASSISTANT" }[];
    project: { name: string } | null;
  }>("/agent/context", { projectId, take });

/**
 * Reserve the subdomain this project publishes at.
 *
 * Sent as a list in preference order — see slugCandidates — so a name already
 * taken is resolved inside the one round trip rather than by asking again.
 * Returns whatever the project already holds if it has published before, which
 * is what keeps a link that has been sent to a client pointing at the site.
 */
export const claimAgentSite = (body: {
  projectId: string;
  candidates: string[];
  domain: string;
}) => call<{ slug: string; url: string }>("/agent/site", body);

/** Persist the run's outcome, with its fragment when there is one. */
export const recordAgentResult = (body: {
  projectId: string;
  content: string;
  type: "RESULT" | "ERROR";
  fragment?: {
    sandboxUrl: string;
    title: string;
    files: Record<string, string>;
    /** Where it was published, when the upload succeeded. */
    siteUrl?: string;
  };
  /** The sandbox the run worked in, so the next run can resume it. */
  bench?: { id: string; provider: string };
}) => call<{ messageId: string }>("/agent/result", body);

/* ---------------------------------------------------------------------------
 * The fast lane. One lead, one site, no sandbox.
 * ------------------------------------------------------------------------- */

/** What is known about the business, plus the voice its site should be in. */
export interface LeadContext {
  name: string;
  trade: string;
  categories: string[];
  town?: string;
  phone?: string;
  address?: string;
  mapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  photo?: string;
  tone?: string;
  alreadyLive: boolean;
}

export const fetchLeadContext = (leadId: string) =>
  call<{ lead: LeadContext | null }>("/site/context", { leadId });

export const claimLeadSite = (body: {
  leadId: string;
  candidates: string[];
  domain: string;
}) => call<{ slug: string; url: string }>("/site/claim", body);

/** What one build did, kept so the screen can be opened up rather than read. */
export interface BuildRecord {
  provider: string;
  tokens: number;
  repairs: number;
  seconds: number;
  headline: string;
  services: string[];
  problems: string[];
  photo?: string;
}

/** Says how it went. One shape for both outcomes so neither can be forgotten. */
export const recordLeadSite = (
  body:
    | {
        leadId: string;
        slug: string;
        url: string;
        template: string;
        build?: BuildRecord;
        error?: never;
      }
    | { leadId: string; error: string },
) => call<{ ok: boolean }>("/site/result", body);

/** Marks a hustle's worth-pitching businesses as waiting to be built. */
export const queueProjectSites = (body: { projectId: string; rebuild?: boolean }) =>
  call<{ queued: number; skipped: number }>("/site/queue", body);

/**
 * Takes the next business off a hustle's queue, best score first.
 *
 * Claims as it reads, so two workers calling this at once get two different
 * businesses. Returns null when the queue is empty, which is how a worker
 * knows to stop rather than by being told how much work there was.
 */
export const takeNextSite = (projectId: string) =>
  call<{ next: { leadId: string; name: string; score: number } | null }>(
    "/site/next",
    { projectId },
  );

/* ---------------------------------------------------------------------------
 * The pitch lane. One lead, one email, one thread.
 * ------------------------------------------------------------------------- */

/** The business, the site built for it, and whoever is signing the email. */
export interface PitchContext {
  name: string;
  trade: string;
  categories: string[];
  town?: string;
  website?: string;
  presence: string;
  siteUrl: string;
  projectId: string;
  userId: string;
  email?: string;
  emailCheckedAt?: number;
  sender: {
    tradingName: string;
    city?: string;
    tone?: string;
    priceBand?: string;
    gmailConnectionId?: string;
    gmailEmail?: string;
  };
  pitched: boolean;
}

export const fetchPitchContext = (leadId: string) =>
  call<{ lead: PitchContext | null }>("/pitch/context", { leadId });

/**
 * Records the email hunt, including when it found nothing.
 *
 * The absence is the point: a business with no published address is the common
 * case, and a run that does not write down having looked will look again every
 * time, at a few hundred fetches a go.
 */
export const recordLeadEmail = (body: {
  leadId: string;
  email?: string;
  source?: string;
}) => call<{ ok: boolean }>("/pitch/email", body);

export const saveLeadPitch = (body: {
  leadId: string;
  to: string;
  subject: string;
  body: string;
  blocked: boolean;
  write: {
    provider: string;
    tokens: number;
    seconds: number;
    rewrites: number;
    problems: string[];
  };
}) => call<{ pitchId: string | null }>("/pitch/draft", body);

/** Marks a hustle's drafts as ready to send. Never touches anything sent. */
export const queueProjectPitches = (projectId: string) =>
  call<{ queued: number }>("/pitch/queue", { projectId });

/**
 * Takes the next pitch off the send queue, claiming it as it reads.
 *
 * Returns the Gmail connection alongside the email, because the alternative is
 * a second round trip per send for a value that cannot change between the two.
 */
/**
 * The sender a claim hands back, as it crosses the bridge.
 *
 * Structurally the same as `Sender` in src/mail — deliberately not imported
 * from there, because this file describes what Convex returns and that file
 * describes what the transports accept. They agree today and the day they
 * stop, the compiler should say so at the one call site that converts between
 * them rather than silently accept a mailbox with no password in it.
 */
export interface BridgeSender {
  mailboxId: string;
  provider: "gmail" | "infraforge";
  email: string;
  name?: string;
  connectionId?: string;
  credentials?: {
    user: string;
    password: string;
    smtpHost?: string;
    smtpPort?: number;
    imapHost?: string;
    imapPort?: number;
  };
}

/**
 * Files a provisioned mailbox, credentials and all.
 *
 * Across the bridge rather than through a public mutation, for one reason: the
 * body carries a password that sends email as somebody. A public mutation is
 * called from a browser, which would mean that password making a round trip
 * through the user's tab to reach the database it never needed to leave the
 * server to get to.
 */
export const recordMailbox = (body: {
  userId: string;
  provider: "gmail" | "infraforge";
  email: string;
  name?: string;
  domain?: string;
  connectionId?: string;
  externalId?: string;
  workspaceId?: string;
  credentials?: {
    user: string;
    password: string;
    smtpHost?: string;
    smtpPort?: number;
    imapHost?: string;
    imapPort?: number;
  };
  preWarmed: boolean;
  status: "provisioning" | "warming" | "active" | "paused" | "failed";
}) => call<{ mailboxId: string }>("/mailbox/record", body);

export const setMailboxStatus = (body: {
  mailboxId: string;
  status: "provisioning" | "warming" | "active" | "paused" | "failed";
  error?: string;
}) => call<{ ok: boolean }>("/mailbox/status", body);

export const takeNextPitch = (projectId: string) =>
  call<{
    next: {
      pitchId: string;
      business: string;
      to: string;
      subject: string;
      body: string;
      sender: BridgeSender;
    } | null;
  }>("/pitch/next", { projectId });

export const recordPitchSent = (body: {
  pitchId: string;
  gmail?: { threadId: string; messageId: string; rfcId?: string };
  error?: string;
}) => call<{ ok: boolean }>("/pitch/sent", body);

/** Every pitch still waiting on an answer. */
export const fetchOpenPitches = (projectId: string) =>
  call<{
    open: {
      pitchId: string;
      threadId: string;
      known: number;
      to: string;
      subject: string;
      business: string;
      siteUrl: string;
      rfcId?: string;
      invoiced: boolean;
      sender: {
        tradingName: string;
        city?: string;
        tone?: string;
        priceBand?: string;
        stripeAccountId?: string;
      };
      /** Which mailbox this conversation lives in. Null when it has none left. */
      mailbox: Omit<BridgeSender, "mailboxId"> | null;
    }[];
  }>("/pitch/open", { projectId });

export const recordPitchReply = (body: {
  pitchId: string;
  messages: { side: "us" | "them"; text: string; at: number }[];
  verdict?: string;
  gist?: string;
}) => call<{ ok: boolean }>("/pitch/reply", body);

/** Businesses with a finished site and nothing written to them yet. */
export const fetchPitchTargets = (projectId: string, limit?: number) =>
  call<{ leads: { leadId: string; name: string; score: number }[] }>(
    "/pitch/targets",
    { projectId, limit },
  );

/** Adds one message to a thread, whichever side wrote it. */
export const appendPitchMessage = (body: {
  pitchId: string;
  side: "us" | "them";
  text: string;
}) => call<{ ok: boolean }>("/pitch/append", body);

/**
 * Files an invoice against the pitch that produced it.
 *
 * Returns false when the pitch already had one, which is not an error — it is
 * the guard against raising a second invoice for the same job, and the caller
 * uses it to decide whether to send the link.
 */
export const recordPitchInvoice = (body: {
  pitchId: string;
  invoice: {
    id: string;
    url: string;
    number?: string;
    amount: number;
    currency: string;
    fee: number;
  };
}) => call<{ recorded: boolean }>("/pitch/invoice", body);

/**
 * Credits a pack somebody paid for.
 *
 * `reference` is the Stripe checkout session id, and passing the same one on a
 * redelivery is what makes this safe to call twice — Convex refuses the second
 * and reports `credited: false`. Never generate it; take it off the event.
 */
export const creditPack = (body: {
  userId: string;
  credits: number;
  reference: string;
}) => call<{ credited: boolean; balance: number }>("/credits/pack", body);

/**
 * Tells Convex which plan a user is on.
 *
 * The one piece of state that has to travel this way rather than in the token:
 * Clerk refuses to put billing claims into a custom JWT template, so the
 * answer is fetched on the Next side — where `auth().has()` works — and
 * relayed. Safe because this door is server-only; see convex/credits.ts.
 */
export const syncEntitlement = (body: {
  userId: string;
  plan: string;
  credits: number;
}) => call<{ plan: string; allowance: number; total: number }>("/credits/plan", body);
