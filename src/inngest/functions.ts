import { z } from "zod";
import {
  openai,
  createAgent,
  createTool,
  createNetwork,
  type Tool,
  type Message,
  createState,
} from "@inngest/agent-kit";

import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";
import { configured as canPublish, publishSite, slugCandidates } from "@/publish";
import { benchFor, type Bench } from "@/workshop";

import { inngest } from "./client";
import { claimAgentSite, fetchAgentContext, recordAgentResult } from "./convex";
import { installModelRetry } from "./model-retry";
import { lastAssistantTextMessageContent, parseAgentOutput } from "./utils";

interface AgentState {
  summary: string;
  files: { [path: string]: string };
}

/**
 * The build.
 *
 * Two things changed here and they are worth separating, because only one of
 * them is about a vendor.
 *
 * The sandbox moved behind src/workshop, so this file no longer knows or cares
 * whether it is standing in E2B or Daytona. That is a swap.
 *
 * The other is that the run now has to prove itself. Before, the agent wrote
 * files, said it was finished, and that was accepted — nothing ever compiled
 * the result, so the first thing to discover a site was broken was the person
 * who opened the preview to show a client. Now the run ends at a passing
 * build or not at all: the agent can compile as it goes, and whatever it
 * claims at the end is checked again here, with any errors handed back for it
 * to fix. `isError` is finally a real verdict rather than "did it say
 * something".
 */

/** How many times the agent gets to fix a build it broke. */
const MAX_REPAIRS = 3;

/** Long enough for a cold `tsc && vite build`, short enough to fail a hang. */
const BUILD_TIMEOUT_SEC = 300;

/**
 * The model.
 *
 * gpt-oss-120b through Groq, which is OpenAI-compatible, so the adapter is the
 * same one and only the endpoint changes. Roughly nine cents a build against
 * about a pound twenty on gpt-4.1, at ~500 tokens/sec, with 128k of context
 * and native tool calling — which is the part that actually matters, because
 * an agent that cannot reliably call a tool cannot build anything.
 */
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const CODE_MODEL = "openai/gpt-oss-120b";

/** The one-line jobs at the end. A frontier model for a six-word title is waste. */
const SCRIBE_MODEL = "openai/gpt-oss-20b";

const groq = (model: string, temperature?: number) =>
  openai({
    model,
    baseUrl: GROQ_BASE_URL,
    apiKey: process.env.GROQ_API_KEY,
    ...(temperature === undefined
      ? {}
      : { defaultParameters: { temperature } }),
  });

/**
 * The provider said no because of a quota, not because of the code.
 *
 * Worth telling apart from every other failure. Groq's free tier allows 8,000
 * tokens a minute, and one turn of this agent — system prompt, the files it
 * has written, the errors it is fixing — is about half of that, so the loop
 * runs into the limit rather than into a bug. Reported as a stack trace it
 * reads as a broken product; reported as itself it is a billing page.
 */
const isRateLimited = (cause: unknown) =>
  /rate limit|429|quota|tokens per minute|TPM/i.test(String(cause));

/** Compile the site. Empty output means it built. */
const compile = async (bench: Bench) => {
  const built = await bench.run("npm run build", {
    timeoutSec: BUILD_TIMEOUT_SEC,
  });

  return {
    ok: built.exitCode === 0,
    // Trimmed from the end: a failing tsc prints the errors last, and the head
    // of the log is the banner nobody needs. Bounded because this goes back
    // into a prompt.
    errors: built.output.slice(-4000),
  };
};

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    // The model's rate limit is a throughput ceiling, not a failure, and this
    // job is not one anybody watches. See model-retry.ts.
    installModelRetry();

    const projectId: string = event.data.projectId;

    // Resumed when this project already has one. The second message about a
    // site is nearly always a change to it, and the bench that still has that
    // site on it is worth more than a clean one.
    const { bench, resumed } = await benchFor(event.data.bench ?? null);

    const context = await step.run("get-previous-messages", async () => {
      // Already oldest-first from Convex, so nothing to reverse here.
      const { messages, project } = await fetchAgentContext(projectId, 5);

      return {
        // Carried through the run because the published subdomain is derived
        // from it, and that happens at the far end — half an hour later, when
        // a second call to fetch one string would be a round trip for nothing.
        name: project?.name ?? "",
        messages: messages.map<Message>((message) => ({
          type: "text" as const,
          role: message.role === "ASSISTANT" ? ("assistant" as const) : ("user" as const),
          content: message.content,
        })),
      };
    });

    const state = createState<AgentState>(
      { summary: "", files: {} },
      { messages: context.messages as Message[] },
    );

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: groq(CODE_MODEL, 0.1),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({ command: z.string() }),
          handler: async ({ command }, { step }) =>
            await step?.run("terminal", async () => {
              const ran = await bench.run(command, { timeoutSec: 120 });
              return ran.exitCode === 0
                ? ran.output
                : `Command failed (exit ${ran.exitCode}):\n${ran.output}`;
            }),
        }),

        createTool({
          name: "build",
          description:
            "Compile the site. Returns the compiler errors, or confirms it built.",
          parameters: z.object({}),
          handler: async (_input, { step }) =>
            await step?.run("build", async () => {
              const { ok, errors } = await compile(bench);
              return ok
                ? "Build passed. The site compiles."
                : `Build FAILED. Fix these and build again:\n\n${errors}`;
            }),
        }),

        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(z.object({ path: z.string(), content: z.string() })),
          }),
          handler: async ({ files }, { step, network }: Tool.Options<AgentState>) => {
            const written = await step?.run("createOrUpdateFiles", async () => {
              try {
                await bench.write(files);

                const updated = { ...(network.state.data.files ?? {}) };
                for (const file of files) updated[file.path] = file.content;
                return updated;
              } catch (cause) {
                return `Error: ${String(cause)}`;
              }
            });

            if (typeof written === "object") network.state.data.files = written;
          },
        }),

        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({ files: z.array(z.string()) }),
          handler: async ({ files }, { step }) =>
            await step?.run("readFiles", async () => {
              const read = await bench.read(files);
              return JSON.stringify(read);
            }),
        }),
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const text = lastAssistantTextMessageContent(result);

          if (text && network && text.includes("<task_summary>")) {
            network.state.data.summary = text;
          }

          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({ network }) => (network.state.data.summary ? undefined : codeAgent),
    });

    try {
      await network.run(event.data.value, { state });
    } catch (cause) {
      if (!isRateLimited(cause)) throw cause;

      await step.run("save-rate-limited", () =>
        recordAgentResult({
          projectId,
          content:
            "The model ran out of tokens partway through. This is a rate " +
            "limit on the AI provider, not a problem with the site — try " +
            "again in a minute, or raise the limit on the provider's plan.",
          type: "ERROR",
          bench: { id: bench.id, provider: bench.provider },
        }),
      );

      await step.run("park-bench", () => bench.release());

      // Whatever it managed to write is still on the bench, and the bench id
      // is now on the project, so the retry picks up where this stopped
      // instead of paying to write the same files again.
      return { url: "", rateLimited: true, bench: { id: bench.id, provider: bench.provider } };
    }

    /**
     * The verdict.
     *
     * Run here rather than trusted from the agent, because the agent saying it
     * built is the thing being checked. It is told to compile before it
     * finishes and usually does, in which case this is a cache hit costing a
     * second — and when it did not, this is the only thing standing between a
     * broken site and a client.
     */
    let verdict = await step.run("verify", () => compile(bench));
    let repairs = 0;

    while (!verdict.ok && repairs < MAX_REPAIRS) {
      repairs += 1;

      // Cleared or the router sees a finished run and returns immediately.
      state.data.summary = "";

      await network.run(
        `The site does not compile. Fix these errors, then call build again to confirm.\n\n${verdict.errors}`,
        { state },
      );

      verdict = await step.run(`verify-${repairs}`, () => compile(bench));
    }

    const files = state.data.files ?? {};

    // Three ways a run is a failure, and only the first was ever caught: no
    // summary, no files, and now — a site that does not compile.
    const isError = !state.data.summary || Object.keys(files).length === 0 || !verdict.ok;

    /**
     * Publishing.
     *
     * The built files are copied out to R2 and served from a subdomain we own,
     * because everything above this line is temporary. A bench is parked after
     * fifteen idle minutes and archived after an hour; a link that has been
     * sent to a client has to answer next week.
     *
     * Deliberately not fatal. A site that compiled is a good outcome even when
     * the copy out of the sandbox failed, and the preview below still works —
     * so a failure here is reported in the reply rather than thrown, and the
     * next message about this project will try again.
     */
    const site = await step.run("publish", async () => {
      if (isError || !canPublish()) return null;

      const domain = process.env.SITES_DOMAIN;
      if (!domain) return null;

      try {
        // The name is settled before the upload rather than after, so that a
        // project that cannot have an address fails having spent nothing.
        const claim = await claimAgentSite({
          projectId,
          candidates: slugCandidates(context.name, projectId),
          domain,
        });

        const built = await bench.collect();

        return { ...(await publishSite(claim.slug, built)), error: null };
      } catch (cause) {
        // Includes the ordinary case of an old project on E2B, whose Next.js
        // tree is a server rather than a folder of files and has nothing to
        // publish — see the collect() in src/workshop/e2b.ts.
        return { slug: "", url: "", files: 0, bytes: 0, error: String(cause) };
      }
    });

    const url = await step.run("serve", async () => {
      // Nothing to show for a build that failed, and starting a dev server on
      // code that does not compile just produces a different error on screen.
      if (isError) return "";
      return await bench.serve();
    });

    const scribe = (name: string, system: string) =>
      createAgent({ name, description: name, system, model: groq(SCRIBE_MODEL) });

    const { output: titleOutput } = await scribe(
      "fragment-title-generator",
      FRAGMENT_TITLE_PROMPT,
    ).run(state.data.summary);

    const { output: replyOutput } = await scribe(
      "response-generator",
      RESPONSE_PROMPT,
    ).run(state.data.summary);

    await step.run("save-result", async () => {
      if (isError) {
        return await recordAgentResult({
          projectId,
          content: verdict.ok
            ? "Something went wrong. Please try again."
            : "The site could not be built without errors. Nothing has been changed.",
          type: "ERROR",
          bench: { id: bench.id, provider: bench.provider },
        });
      }

      const reply = parseAgentOutput(replyOutput);

      return await recordAgentResult({
        projectId,
        content: site?.error
          ? `${reply}

The site built but could not be published, so this ` +
            "preview link is temporary. It will be retried on the next change."
          : reply,
        type: "RESULT",
        fragment: {
          sandboxUrl: url,
          title: parseAgentOutput(titleOutput),
          files,
          ...(site?.url ? { siteUrl: site.url } : {}),
        },
        bench: { id: bench.id, provider: bench.provider },
      });
    });

    // Parked, not destroyed — the next message about this site wants this
    // exact tree. On E2B this is a no-op and the sandbox times out as before.
    await step.run("park-bench", () => bench.release());

    return {
      url,
      // The address that outlives this run. `url` above is the bench, and the
      // two are reported separately because only one of them is worth keeping.
      siteUrl: site?.url || "",
      title: "Fragment",
      files,
      summary: state.data.summary,
      bench: { id: bench.id, provider: bench.provider },
      resumed,
      repairs,
      built: verdict.ok,
    };
  },
);
