/**
 * Writes a pitch for a handful of invented businesses and reads it back.
 *
 * The same job brief-check does for site copy, and for the same reason: the
 * rules in src/pitch live in a prompt and a regex list, and the only way to
 * know whether either works is to run it and read the output. A cold email is
 * the one artefact in this codebase that cannot be corrected after the fact,
 * so it is worth being sure before a real one goes to a real stranger.
 *
 *   npm run pitch:check
 */
import { checkPitch } from "../src/pitch/check";
import { writePitch, type Sender } from "../src/pitch/write";

const SENDER: Sender = {
  tradingName: "Ridge & Co",
  city: "Jacksonville",
  tone: "local",
  priceBand: "500_1500",
};

const BUSINESSES = [
  {
    name: "Bliss Yoga",
    trade: "Yoga studio",
    town: "Jacksonville, FL",
    categories: ["Yoga studio", "Pilates studio"],
    siteUrl: "https://bliss-yoga.korvians.online",
  },
  {
    name: "BFND Food Truck",
    trade: "Food truck",
    town: "Jacksonville, FL",
    categories: ["Food truck", "Caterer"],
    siteUrl: "https://bfnd-food-truck.korvians.online",
  },
  {
    name: "Bottles Up Enterprises",
    trade: "Bartending service",
    town: "Jacksonville, FL",
    categories: ["Bartending service", "Event planner"],
    siteUrl: "https://bottles-up-enterprises.korvians.online",
  },
];

/** The same sender with no price band — the email may not mention money. */
const QUIET: Sender = { ...SENDER, priceBand: undefined };

const line = "─".repeat(72);

const main = async () => {
  let tokens = 0;
  let blocked = 0;

  for (const [index, business] of BUSINESSES.entries()) {
    // The last one is written by somebody who never set a price, which is the
    // case that has to come back with no number in it at all.
    const sender = index === BUSINESSES.length - 1 ? QUIET : SENDER;
    const started = Date.now();

    const pitch = await writePitch(business, sender);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);

    tokens += pitch.tokens;
    if (pitch.blocked) blocked += 1;

    console.log(line);
    console.log(`${business.name}   ${seconds}s · ${pitch.provider} · ${pitch.tokens} tokens`);
    if (sender.priceBand === undefined) console.log("(no price band — must not mention money)");
    console.log(line);
    console.log(`Subject: ${pitch.subject}`);
    console.log();
    console.log(pitch.body);
    console.log();

    if (pitch.rewrites) console.log(`rewritten ${pitch.rewrites}×`);

    if (pitch.problems.length === 0) {
      console.log("checker: clean");
    } else {
      for (const problem of pitch.problems) {
        console.log(`checker: ${problem.severity.toUpperCase()} — ${problem.message}`);
      }
    }

    if (pitch.blocked) console.log("BLOCKED — this one would not be sent.");
    console.log();
  }

  /* ---- and the other half: does the checker catch what it should? ---- */

  const MUST_CATCH: [string, string][] = [
    ["passing", "I was passing your shop yesterday and noticed you have no website. https://x.test"],
    ["prior call", "Following up on our call last week. https://x.test"],
    ["they contacted us", "You reached out about a website, so I built one. https://x.test"],
    ["guarantee", "I guarantee you'll get more bookings from it. https://x.test"],
    ["result", "This will double your bookings within a month. https://x.test"],
    ["ranking", "It will get you to page one of Google. https://x.test"],
    ["urgency", "Limited time — I can only hold this for you until Friday. https://x.test"],
    ["scarcity", "Only 3 spots left this month. https://x.test"],
    ["credential", "As an award-winning designer I built you this. https://x.test"],
    ["placeholder", "Hi [Name], I built you a site. https://x.test"],
    ["markdown", "**I built you a site.** https://x.test"],
    ["no link", "I built you a website. Let me know what you think."],
    ["two links", "Here: https://x.test and again https://x.test"],
    ["other link", "Here: https://x.test — also see https://tracker.test/open"],
    ["invented price", "I built you a site, it is $400. https://x.test"],
  ];

  const MUST_ALLOW = [
    "I build websites for local businesses and I made one for Bliss Yoga. It is live now, nothing to sign up for.\n\nhttps://x.test\n\nHave a look. If you like it, reply and I will move it to your own address. If not, no hard feelings.",
  ];

  console.log(line);
  console.log("checker, against text written to break it");
  console.log(line);

  let missed = 0;

  for (const [label, text] of MUST_CATCH) {
    const problems = checkPitch({
      subject: "a website for your business",
      body: text,
      business: "Bliss Yoga",
      siteUrl: "https://x.test",
    });

    const caught = problems.some((p) => p.severity === "bad");
    if (!caught) missed += 1;

    console.log(`${caught ? "caught " : "MISSED "} ${label}`);
  }

  let falsePositives = 0;

  for (const text of MUST_ALLOW) {
    const problems = checkPitch({
      subject: "a website for Bliss Yoga",
      body: text,
      business: "Bliss Yoga",
      siteUrl: "https://x.test",
    });

    const bad = problems.filter((p) => p.severity === "bad");
    if (bad.length) {
      falsePositives += 1;
      console.log(`FALSE POSITIVE — ${bad.map((p) => p.message).join(", ")}`);
    }
  }

  console.log();
  console.log(line);
  console.log(
    `${BUSINESSES.length} written · ${blocked} blocked · ${tokens} tokens · ` +
      `${MUST_CATCH.length - missed}/${MUST_CATCH.length} caught · ` +
      `${falsePositives} false positives`,
  );
};

void main();
