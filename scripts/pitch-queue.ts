import { draftPitches, sendPitches } from "@/pitch-queue";

/**
 * Writes — and only if asked, sends — a hustle's pitches.
 *
 *   npm run pitch:queue -- <projectId>              write drafts
 *   npm run pitch:queue -- <projectId> --limit 10   write ten of them
 *   npm run pitch:queue -- <projectId> --send       send what is queued
 *
 * Drafting and sending are separate flags rather than one run, and the default
 * is the harmless one. Everything else in this codebase can be re-run; this is
 * the one place where the mistake goes to somebody else's inbox.
 */

const line = "─".repeat(78);

const main = async () => {
  const args = process.argv.slice(2);
  const projectId = args.find((arg) => !arg.startsWith("-") && !/^\d+$/.test(arg));

  if (!projectId) {
    console.log("Usage: npm run pitch:queue -- <projectId> [--limit N] [--send]");
    return;
  }

  const limitAt = args.indexOf("--limit");
  const limit = limitAt === -1 ? undefined : Number(args[limitAt + 1]) || undefined;

  if (args.includes("--send")) {
    console.log(`Sending ${projectId}. Slowly — about ninety an hour, on purpose.\n`);

    const result = await sendPitches(projectId, {
      events: {
        onSent: (sent) =>
          console.log(`sent    ${sent.business.slice(0, 38).padEnd(38)} ${sent.to}`),
        onFailed: (failed) =>
          console.log(
            `FAILED  ${failed.business.slice(0, 38).padEnd(38)} ` +
              failed.error.replace(/\s+/g, " ").slice(0, 100),
          ),
      },
    });

    console.log(`\n${line}`);
    console.log(`queued  ${result.queued}`);
    console.log(`sent    ${result.sent.length}`);
    console.log(`failed  ${result.failed.length}`);
    if (result.capped) console.log("stopped at the daily cap, not at the bottom of the queue");
    console.log(`time    ${result.seconds.toFixed(0)}s`);

    return;
  }

  console.log(`Writing pitches for ${projectId}${limit ? `, first ${limit}` : ""}.`);
  console.log("Nothing is sent. Every one of these lands as a draft.\n");

  let done = 0;

  const result = await draftPitches(projectId, {
    limit,
    events: {
      onDrafted: (pitch) => {
        done += 1;
        console.log(
          `${String(done).padStart(4)}  ${pitch.name.slice(0, 30).padEnd(30)} ` +
            `${pitch.seconds.toFixed(1)}s  ${pitch.to.slice(0, 32).padEnd(32)} ` +
            `${pitch.blocked ? "BLOCKED " : pitch.problems.length ? "noted   " : "clean   "}` +
            pitch.subject.slice(0, 44),
        );
      },
      onSkipped: (lead) => {
        done += 1;
        console.log(
          `${String(done).padStart(4)}  ${lead.name.slice(0, 30).padEnd(30)} —     ` +
            lead.why.replace(/\s+/g, " ").slice(0, 90),
        );
      },
    },
  });

  const tokens = result.drafted.reduce((total, pitch) => total + pitch.tokens, 0);
  const blocked = result.drafted.filter((pitch) => pitch.blocked).length;

  console.log(`\n${line}`);
  console.log(`drafted      ${result.drafted.length}`);
  console.log(`blocked      ${blocked}   (written, refused, left for a person to read)`);
  console.log(`unreachable  ${result.unreachable.length}   (site built, no email anywhere)`);
  console.log(`failed       ${result.failed.length}`);
  console.log(`tokens       ${tokens.toLocaleString()}`);
  console.log(`time         ${result.seconds.toFixed(0)}s`);
};

void main();
