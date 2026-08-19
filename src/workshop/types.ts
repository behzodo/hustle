/**
 * What the agent needs from a place to build in, and nothing else.
 *
 * Written as an interface for the same reason convex/lib/places has one: the
 * thing behind it is a vendor, vendors run out or get slow or get replaced,
 * and the day that happens should cost one file rather than a rewrite of the
 * agent. E2B built every site up to now; Daytona builds them from here. Both
 * satisfy this, and the agent cannot tell which one it is standing in.
 *
 * Deliberately small. A sandbox SDK offers dozens of things — LSP servers,
 * computer use, object storage, port forwarding — and every one of them
 * adopted here is a thing the next provider has to match. The agent runs
 * commands, moves files, and needs a URL to show. That is the whole contract.
 */

export type WorkshopName = "daytona" | "e2b";

export interface BenchFile {
  path: string;
  content: string;
}

/** One file of a built site, ready to be copied to wherever it is served. */
export interface BuiltFile {
  /** Relative to the build output, e.g. "index.html", "assets/index-a1b2.js". */
  path: string;
  bytes: Buffer;
}

export interface Ran {
  /** Zero means it worked. The verify step reads this and nothing else. */
  exitCode: number;
  /** stdout and stderr together, as a shell would show them. */
  output: string;
}

export interface RunOptions {
  /** Relative to the bench root unless absolute. */
  cwd?: string;
  timeoutSec?: number;
}

/** One sandbox, open and ready to be worked in. */
export interface Bench {
  readonly id: string;
  readonly provider: WorkshopName;
  /**
   * Where the site lives. Every provider puts it somewhere different, and the
   * agent should not have to know which — its commands are run from here.
   */
  readonly root: string;

  run(command: string, options?: RunOptions): Promise<Ran>;
  write(files: BenchFile[]): Promise<void>;
  read(paths: string[]): Promise<BenchFile[]>;

  /**
   * The finished site: every file `npm run build` produced, as bytes.
   *
   * Bytes rather than strings because this is the built output, not source —
   * it is mostly text but it is not only text, and reading a favicon or a
   * compressed font as UTF-8 corrupts it silently. Nothing downstream needs it
   * decoded anyway: whatever ends up hosting these copies them across
   * unchanged.
   *
   * Paths come back relative to the build directory, so `dist/index.html` is
   * `index.html` — which is what it will be called wherever it is served from.
   */
  collect(): Promise<BuiltFile[]>;

  /** A URL showing whatever is serving on that port, from outside. */
  preview(port: number): Promise<string>;

  /**
   * Start the dev server, and do not come back until it is answering.
   *
   * Separate from `run` because it is the opposite kind of command: `run`
   * finishes and hands back an exit code, and a dev server never finishes. Run
   * through the normal path it blocks forever and the build times out.
   *
   * Returning only once the port answers is the point. The URL exists the
   * moment the sandbox does, so handing it back any earlier gives the caller a
   * link to a connection refused — which is what a user sees as a blank
   * preview pane they assume is a broken build.
   */
  serve(): Promise<string>;

  /**
   * Let it go.
   *
   * Not necessarily destroyed: a provider that can park a sandbox cheaply and
   * bring it back should, because the next message in a project wants the same
   * node_modules it had ten minutes ago. What must be true afterwards is only
   * that nobody is being billed for an idle machine.
   */
  release(): Promise<void>;
}

export interface Workshop {
  readonly name: WorkshopName;
  /** Whether this provider has the keys it needs. */
  configured(): boolean;
  /** A fresh bench, ready to build in. */
  open(): Promise<Bench>;
  /**
   * The bench a previous run left behind, or null if it is gone.
   *
   * Null rather than a throw: a sandbox that has been reaped is the normal end
   * of a sandbox's life, not an error, and the caller's answer is always the
   * same — open a new one.
   */
  reopen(id: string): Promise<Bench | null>;
}

export class WorkshopError extends Error {
  constructor(
    message: string,
    /** False for a bad key or a missing image — trying again cannot help. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "WorkshopError";
  }
}
