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

/** The last few messages of a project, for the agent's memory window. */
export const fetchAgentContext = (projectId: string, take = 5) =>
  call<{ messages: { content: string; role: "USER" | "ASSISTANT" }[] }>(
    "/agent/context",
    { projectId, take },
  );

/** Persist the run's outcome, with its fragment when there is one. */
export const recordAgentResult = (body: {
  projectId: string;
  content: string;
  type: "RESULT" | "ERROR";
  fragment?: {
    sandboxUrl: string;
    title: string;
    files: Record<string, string>;
  };
}) => call<{ messageId: string }>("/agent/result", body);
