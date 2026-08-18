import { Sandbox } from "@e2b/code-interpreter";

import { SANDBOX_TIMEOUT } from "@/inngest/types";

import {
  WorkshopError,
  type Bench,
  type BenchFile,
  type BuiltFile,
  type Ran,
  type RunOptions,
  type Workshop,
} from "./types";

/**
 * E2B, kept.
 *
 * Every site built before Daytona was built here, and it works. It stays
 * behind the same interface until Daytona has run twenty real builds without
 * incident, and then this file goes — a second sandbox provider carried
 * indefinitely is two things to keep working for the benefit of neither.
 *
 * The difference that matters is at the bottom of the file: an E2B sandbox
 * cannot be parked and resumed, so `release` ends it. A project whose second
 * message lands here rebuilds its tree from nothing.
 */

/**
 * The image, which is a Next.js one.
 *
 * Left as it is on purpose. Sites are Vite from here, but this provider exists
 * to keep old projects opening, and old projects are Next.js — repointing it at
 * a template their files do not match would break the thing it is here to
 * protect.
 */
const TEMPLATE = "vibe-nextjs-test-2";

const ROOT = "/home/user";

const bench = (sandbox: Sandbox): Bench => ({
  id: sandbox.sandboxId,
  provider: "e2b",
  root: ROOT,

  async run(command: string, options: RunOptions = {}): Promise<Ran> {
    // E2B throws on a non-zero exit rather than returning it, which is exactly
    // backwards for a verify step: a failing build is the signal, not an
    // outage. Caught here so both providers answer the same shape.
    try {
      const result = await sandbox.commands.run(command, {
        cwd: options.cwd ?? ROOT,
        timeoutMs: options.timeoutSec ? options.timeoutSec * 1000 : undefined,
      });

      return {
        exitCode: result.exitCode ?? 0,
        output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
      };
    } catch (cause) {
      const error = cause as { exitCode?: number; stdout?: string; stderr?: string };

      if (typeof error.exitCode === "number") {
        return {
          exitCode: error.exitCode,
          output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
        };
      }

      throw new WorkshopError(`Command failed to run: ${String(cause)}`, true);
    }
  },

  async write(files: BenchFile[]): Promise<void> {
    for (const file of files) await sandbox.files.write(file.path, file.content);
  },

  async read(paths: string[]): Promise<BenchFile[]> {
    const read = await Promise.all(
      paths.map(async (path) => {
        try {
          return { path, content: await sandbox.files.read(path) };
        } catch {
          return null;
        }
      }),
    );

    return read.filter((file): file is BenchFile => file !== null);
  },

  async collect(): Promise<BuiltFile[]> {
    // Nothing to collect. This provider builds Next.js apps, which are a
    // server and not a folder of files — there is no `dist` to copy anywhere.
    // Old projects opening on E2B keep working as they always did: their
    // preview is the sandbox, and it lasts as long as the sandbox does.
    throw new WorkshopError(
      "Sites built on E2B cannot be published — they are Next.js apps, not static files.",
      false,
    );
  },

  async preview(port: number): Promise<string> {
    return `https://${sandbox.getHost(port)}`;
  },

  async serve(): Promise<string> {
    // Nothing to start. The Next.js template this provider boots runs its own
    // dev server from the image's entrypoint — that is what `compile_page.sh`
    // in sandbox-templates/nextjs does — so by the time a bench exists here,
    // something is already listening.
    return `https://${sandbox.getHost(3000)}`;
  },

  async release(): Promise<void> {
    // Nothing to park: an E2B sandbox has no stopped state to go to, and its
    // own timeout ends it regardless. Said explicitly so the difference from
    // Daytona is visible here rather than inferred from its absence.
  },
});

export const configured = () => Boolean(process.env.E2B_API_KEY);

export const open = async (): Promise<Bench> => {
  const sandbox = await Sandbox.create(TEMPLATE);
  await sandbox.setTimeout(SANDBOX_TIMEOUT);
  return bench(sandbox);
};

export const reopen = async (id: string): Promise<Bench | null> => {
  try {
    return bench(await Sandbox.connect(id));
  } catch {
    return null;
  }
};

export const workshop: Workshop = {
  name: "e2b",
  configured,
  open,
  reopen,
};
