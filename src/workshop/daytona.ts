import { Daytona, Image, type Sandbox } from "@daytona/sdk";

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
 * Daytona: the bench a client site is built on.
 *
 * Two things it does that the E2B setup did not.
 *
 * It boots from a snapshot with `node_modules` already in it. A measured cold
 * run — raw `node:22`, scaffold, install, build — took 21 seconds, and 11 of
 * those were npm install, every time, for a tree that never changes. Baked
 * into the image that cost is paid once when the snapshot is built.
 *
 * And a sandbox can be parked and brought back. The second message in a
 * project is nearly always a change to the site the first one made, so the
 * bench it wants is the bench that still has that site on it. Stopped
 * sandboxes are not billed as running ones, so keeping it costs the disk
 * rather than the machine.
 */

/**
 * The image the bench boots from.
 *
 * The scaffold is generated rather than checked in: `npm create vite@latest`
 * pins React, Vite and TypeScript itself, so nothing in this repo has to be
 * kept in step with them by hand. Only the files that scaffold gets wrong for
 * this product are laid over it — see sandbox-templates/vite/README.md.
 *
 * The final build is not a test. It is what fills Vite's cache and node's
 * resolution cache inside the image, so the first real build in a sandbox is
 * an incremental one. It also means a template that cannot compile fails when
 * the snapshot is built, in front of whoever built it, rather than half an
 * hour into a customer's site.
 */
export const SITE_ROOT = "/home/daytona/site";

export const benchImage = () =>
  Image.base("node:22-bookworm-slim")
    .env({
      CI: "1",
      npm_config_fund: "false",
      npm_config_audit: "false",
      npm_config_update_notifier: "false",
    })
    .workdir("/home/daytona")
    .runCommands(
      "apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*",
      "npm create vite@latest site -- --template react-ts --yes",
    )
    .addLocalDir("sandbox-templates/vite", SITE_ROOT)
    .workdir(SITE_ROOT)
    .runCommands(
      "npm install",
      "npm install tailwindcss @tailwindcss/vite",
      "npm run build",
      // The bake artefacts are not the client's site. Leaving them means the
      // first `npm run build` in a sandbox reports a dist that predates
      // anything the agent wrote.
      "rm -rf dist",
    );

/**
 * The snapshot the bench boots from, by name.
 *
 * Versioned in the name rather than mutated in place. A snapshot is a cache of
 * a build, sandboxes are created from it by name, and quietly changing what a
 * name points to means a project resumed tomorrow boots a different machine
 * from the one it was built on. Bump this when the image above changes.
 */
export const SNAPSHOT = "hustle-vite-2";

/**
 * What one bench is given, and why it is not more.
 *
 * These are fixed when the snapshot is built, not when a sandbox is created,
 * so they are here beside the name that carries them.
 *
 * The number to watch is not the build's — it is the organisation's. Daytona
 * caps total memory across every running sandbox, and the tier this account is
 * on allows 10 GiB. At the 4 GiB this started on that is two builds at once
 * before the third is refused outright, which for a product that builds a site
 * per lead is a ceiling reached on a quiet afternoon.
 *
 * Two gigabytes is well clear of what the work needs — the template compiles
 * in 141ms and the tree is thirty packages — and it turns two concurrent
 * builds into five. Raise the tier before raising this.
 */
export const BENCH_RESOURCES = { cpu: 2, memory: 2, disk: 5 } as const;

const key = () => {
  const value = process.env.DAYTONA_API_KEY;

  if (!value) {
    throw new WorkshopError(
      'Daytona is not configured. Set DAYTONA_API_KEY in .env.',
      false,
    );
  }

  return value;
};

let client: Daytona | null = null;

const daytona = () => (client ??= new Daytona({ apiKey: key() }));

/** How long a sandbox sits idle before it is parked, in minutes. */
const IDLE_STOP_MIN = 15;

/** And how long it sits stopped before its disk goes to cold storage. */
const IDLE_ARCHIVE_MIN = 60;

/** Where `npm run build` puts the finished site — see the Vite config. */
const DIST_DIR = "dist";

/** The port the Vite dev server is pinned to — see sandbox-templates/vite. */
export const DEV_PORT = 5173;

/**
 * A note on regions, because the obvious change here is wrong.
 *
 * Sandboxes are created wherever their snapshot lives, and this one is built
 * in the organisation's default region. Asking `create` for a different target
 * does not move it — it is accepted, ignored, and costs about ten seconds on
 * every open while it works that out. Measured: 1.5s without, 11.5s with.
 *
 * To actually move them, the snapshot has to be built in that region too, and
 * both have to be changed together. Worth doing when it is worth doing: the
 * finished client site is not served from here, so the only person a region
 * affects is whoever is watching the preview while the agent works.
 */

/** The background session the dev server runs in. */
const DEV_SESSION = "dev-server";

/**
 * Waits for the dev server to actually answer, from inside the sandbox.
 *
 * Polled from in here rather than against the preview URL because that URL
 * goes through a proxy that answers before the server behind it does — so a
 * check from outside can pass while the thing being checked is still starting.
 *
 * Node rather than curl: it is guaranteed present in this image and curl is
 * not, and adding a package to the image to run one health check would mean
 * rebuilding the snapshot.
 */
const WAIT_FOR_DEV = `node -e "const t=Date.now();(function p(){require('http').get('http://127.0.0.1:${DEV_PORT}',()=>process.exit(0)).on('error',()=>Date.now()-t>90000?process.exit(1):setTimeout(p,400))})()"`;

const bench = (sandbox: Sandbox): Bench => ({
  id: sandbox.id,
  provider: "daytona",
  root: SITE_ROOT,

  async run(command: string, options: RunOptions = {}): Promise<Ran> {
    const result = await sandbox.process.executeCommand(
      command,
      options.cwd ?? SITE_ROOT,
      undefined,
      options.timeoutSec,
    );

    return {
      // The SDK leaves this undefined on some paths. Treating a missing exit
      // code as success would let the verify step pass a build that never ran.
      exitCode: result.exitCode ?? 1,
      output: result.result ?? "",
    };
  },

  async write(files: BenchFile[]): Promise<void> {
    if (files.length === 0) return;

    await sandbox.fs.uploadFiles(
      files.map((file) => ({
        source: Buffer.from(file.content, "utf8"),
        destination: absolute(file.path),
      })),
    );
  },

  async read(paths: string[]): Promise<BenchFile[]> {
    const read = await Promise.all(
      paths.map(async (path) => {
        try {
          const buffer = await sandbox.fs.downloadFile(absolute(path));
          return { path, content: buffer.toString("utf8") };
        } catch {
          // A file the agent guessed at and got wrong is a normal step in
          // exploring a tree, not a failure of the run.
          return null;
        }
      }),
    );

    return read.filter((file): file is BenchFile => file !== null);
  },

  async collect(): Promise<BuiltFile[]> {
    // Listed from inside rather than walked from out here: one command
    // returns the whole tree, where walking it would be a round trip per
    // directory against a sandbox on another continent.
    // Plain `find`, printing full paths that are trimmed below, rather than
    // `-printf '%P'` to have it strip them: that format string needs a
    // backslash-n which a template literal turns into a real newline before
    // the shell ever sees it, and the command then prints blank lines.
    const listed = await sandbox.process.executeCommand(
      `find ${DIST_DIR} -type f`,
      SITE_ROOT,
      undefined,
      60,
    );

    if (listed.exitCode !== 0) {
      throw new WorkshopError(
        "There is no built site to collect. Run the build first.",
        false,
      );
    }

    const paths = (listed.result ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      // "dist/assets/index.js" is served as "assets/index.js" — the build
      // directory is an artefact of building here, not part of the site.
      .map((line) => line.replace(new RegExp(`^\\.?/?${DIST_DIR}/`), ""));

    return await Promise.all(
      paths.map(async (path) => ({
        path,
        bytes: await sandbox.fs.downloadFile(`${SITE_ROOT}/${DIST_DIR}/${path}`),
      })),
    );
  },

  async preview(port: number): Promise<string> {
    const link = await sandbox.getPreviewLink(port);
    return link.url;
  },

  async serve(): Promise<string> {
    // A session is a shell that outlives the call that started it, which is
    // the only way to run something that never exits. Creating one that is
    // already there throws, and on a resumed sandbox it always is.
    await sandbox.process.createSession(DEV_SESSION).catch(() => {});

    await sandbox.process.executeSessionCommand(DEV_SESSION, {
      command: `cd ${SITE_ROOT} && npm run dev`,
      // Without this the call waits for a command that by definition never
      // returns, and the build dies on its own timeout with the dev server
      // running perfectly well behind it.
      runAsync: true,
    });

    const ready = await sandbox.process.executeCommand(
      WAIT_FOR_DEV,
      SITE_ROOT,
      undefined,
      120,
    );

    if (ready.exitCode !== 0) {
      throw new WorkshopError(
        "The dev server did not come up. The site may not compile.",
        true,
      );
    }

    return (await sandbox.getPreviewLink(DEV_PORT)).url;
  },

  async release(): Promise<void> {
    // Stopped, not deleted. The next message in this project wants this exact
    // tree back, and a stopped sandbox is billed for its disk rather than its
    // machine. The auto-archive interval takes it to cold storage after that,
    // and Daytona reaps it eventually on its own.
    await daytona().stop(sandbox);
  },
});

const absolute = (path: string) =>
  path.startsWith("/") ? path : `${SITE_ROOT}/${path.replace(/^\.\//, "")}`;

export const configured = () => Boolean(process.env.DAYTONA_API_KEY);

export const open = async (): Promise<Bench> => {
  try {
    const sandbox = await daytona().create(
      {
        snapshot: SNAPSHOT,
        // Otherwise the preview link carries a token and anything that embeds
        // it — the preview pane, a link sent to a client — gets a 401. What is
        // behind it is a marketing site for a business that wants to be found,
        // so there is nothing here to keep private.
        public: true,
        autoStopInterval: IDLE_STOP_MIN,
        autoArchiveInterval: IDLE_ARCHIVE_MIN,
      },
      { timeout: 180 },
    );

    return bench(sandbox);
  } catch (cause) {
    const message = String(cause);

    // The snapshot is built by `npm run workshop:snapshot`, so a missing one
    // is a setup step nobody ran rather than anything that will come good on
    // a retry.
    throw new WorkshopError(
      message.includes("snapshot") || message.includes("not found")
        ? `The "${SNAPSHOT}" snapshot does not exist yet. Run: npm run workshop:snapshot`
        : `Could not open a Daytona bench: ${message}`,
      !message.includes("snapshot"),
    );
  }
};

export const reopen = async (id: string): Promise<Bench | null> => {
  try {
    const sandbox = await daytona().get(id);
    // Parked or archived by the intervals above; bringing it back is the whole
    // reason it was parked rather than deleted.
    if (sandbox.state !== "started") await daytona().start(sandbox);
    return bench(sandbox);
  } catch {
    return null;
  }
};

export const workshop: Workshop = {
  name: "daytona",
  configured,
  open,
  reopen,
};
