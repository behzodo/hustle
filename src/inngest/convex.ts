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

/** Says how it went. One shape for both outcomes so neither can be forgotten. */
export const recordLeadSite = (
  body:
    | { leadId: string; slug: string; url: string; template: string; error?: never }
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
