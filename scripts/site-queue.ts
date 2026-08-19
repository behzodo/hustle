import { runQueue, WORKERS } from "@/build-queue";

/**
 * Builds every worth-pitching business in a hustle.
 *
 *   npm run site:queue -- <projectId>
 *   npm run site:queue -- <projectId> --rebuild
 *   npm run site:queue -- <projectId> --workers 2
 *
 * Prints as it goes rather than at the end, because the interesting part of a
 * run over two hundred businesses is not the summary — it is whether the third
 * one failed for a reason that will also break the other hundred and ninety
 * seven.
 */

const main = async () => {
  const args = process.argv.slice(2);
  const projectId = args.find((arg) => !arg.startsWith("-"));

  if (!projectId) {
    console.log("Usage: npm run site:queue -- <projectId> [--rebuild] [--workers N]");
    return;
  }

  const rebuild = args.includes("--rebuild");
  const workersAt = args.indexOf("--workers");
  const workers = workersAt === -1 ? WORKERS : Number(args[workersAt + 1]) || WORKERS;

  console.log(`Queueing ${projectId}${rebuild ? " (rebuilding live sites too)" : ""}`);
  console.log(`${workers} at a time.\n`);

  let done = 0;

  const result = await runQueue(projectId, {
    rebuild,
    workers,
    events: {
      onBuilt: (site) => {
        done += 1;
        console.log(
          `${String(done).padStart(4)}  ${site.name.slice(0, 34).padEnd(34)} ` +
            `${site.template.padEnd(10)} ${site.seconds.toFixed(1)}s  ` +
            `${site.repairs ? `${site.repairs} repair  ` : "          "}${site.url}`,
        );
      },
      onFailed: (site) => {
        done += 1;
        console.log(
          `${String(done).padStart(4)}  ${site.name.slice(0, 34).padEnd(34)} FAILED  ` +
            site.error.replace(/\s+/g, " ").slice(0, 120),
        );
      },
    },
  });

  const built = result.built;
  const tokens = built.reduce((total, site) => total + site.tokens, 0);
  const repaired = built.filter((site) => site.repairs > 0).length;

  console.log(`\n${"─".repeat(72)}`);
  console.log(`queued    ${result.queued}   (${result.skipped} already live or in flight)`);
  console.log(`built     ${built.length}`);
  console.log(`failed    ${result.failed.length}`);
  console.log(`repaired  ${repaired}`);
  console.log(`tokens    ${tokens.toLocaleString()}`);
  console.log(`time      ${result.seconds.toFixed(1)}s`);

  if (built.length) {
    const each = result.seconds / built.length;
    console.log(`          ${each.toFixed(2)}s per site, ${Math.round(3600 / each)} an hour`);
  }

  // Which template each trade landed on, so a router that is sending every
  // business to the fallback is visible without reading two hundred lines.
  const byTemplate = new Map<string, number>();
  for (const site of built) {
    byTemplate.set(site.template, (byTemplate.get(site.template) ?? 0) + 1);
  }

  if (byTemplate.size) {
    console.log(
      `templates ${[...byTemplate].map(([name, n]) => `${name} ${n}`).join(", ")}`,
    );
  }
};

void main();
