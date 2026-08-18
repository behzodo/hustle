/**
 * Build the image a client site is assembled on.
 *
 *   npm run workshop:snapshot
 *
 * Run it once to set the project up, and again whenever
 * src/workshop/daytona.ts or sandbox-templates/vite/ changes — bumping
 * SNAPSHOT first, because sandboxes are created from a snapshot by name and
 * changing what a name points to means a project resumed tomorrow boots a
 * different machine from the one it was built on.
 *
 * The work this does — install a dependency tree, compile it once — is work
 * every single build would otherwise repeat. Measured on a bare node:22
 * image, the install alone was eleven of the twenty-one seconds it took to get
 * from nothing to a built site, for a tree that is identical every time.
 */
import { Daytona } from "@daytona/sdk";

import { BENCH_RESOURCES, SNAPSHOT, benchImage } from "../src/workshop/daytona";

const apiKey = process.env.DAYTONA_API_KEY;

if (!apiKey) {
  console.error("DAYTONA_API_KEY is not set. Add it to .env and try again.");
  process.exit(1);
}

const daytona = new Daytona({ apiKey });

const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;

// Wrapped rather than run at the top level: the project is not an ES module,
// so tsx compiles this to CommonJS, where a top-level await is a syntax error.
const main = async () => {
  console.log(`Building snapshot "${SNAPSHOT}" — this takes a few minutes.\n`);

  try {
    await daytona.snapshot.create(
      {
        name: SNAPSHOT,
        image: benchImage(),
        // Sized against the organisation's total memory cap rather than the
        // build's appetite — see BENCH_RESOURCES.
        resources: { ...BENCH_RESOURCES },
      },
      { onLogs: (line: string) => process.stdout.write(line) },
    );

    console.log(`\n\nSnapshot "${SNAPSHOT}" is ready in ${elapsed()}.`);
  } catch (cause) {
    const message = String(cause);

    // Building the same name twice is the normal result of running this after
    // a change without bumping SNAPSHOT, and it is worth saying plainly rather
    // than letting a raw conflict error imply the setup is broken.
    if (/already exists/i.test(message)) {
      console.error(
        `\nA snapshot called "${SNAPSHOT}" already exists.\n\n` +
          "Nothing was changed. To publish a new image, bump SNAPSHOT in\n" +
          "src/workshop/daytona.ts and run this again — an existing snapshot\n" +
          "is never overwritten, because projects already resume from it.",
      );
      process.exit(1);
    }

    console.error(`\nSnapshot build failed after ${elapsed()}:\n${message}`);
    process.exit(1);
  }
};

void main();
