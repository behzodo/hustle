import { renderSite, templateFor } from "@/blocks/render";
import type { BusinessFacts } from "@/blocks/types";
import { writeBrief } from "@/brief";
import { publishSite, siteUrl, slugify } from "@/publish";

/**
 * Writes real briefs for sparse businesses and checks nothing was invented.
 *
 *   npm run brief:check
 *
 * The businesses below carry roughly what a sweep actually returns, which is
 * far less than a model would like. That is the point: the invention it has to
 * be caught doing is the invention it commits when there is a gap to fill, and
 * a test built from a complete listing never opens one.
 */

const CASES: { facts: BusinessFacts; categories: string[] }[] = [
  {
    // The common case. A name, a trade, a number.
    facts: {
      name: "Ellerman Plumbing",
      trade: "Plumber",
      town: "Key Largo, FL",
      phone: "(305) 555 0182",
    },
    categories: ["Plumber", "Drainage service"],
  },
  {
    facts: {
      name: "Fade Room",
      trade: "Barber shop",
      town: "Tavernier, FL",
      phone: "(305) 555 0110",
      rating: 4.6,
      reviewCount: 88,
    },
    categories: ["Barber shop", "Hair salon"],
  },
  {
    facts: {
      name: "Blue Marlin Cafe",
      trade: "Café",
      town: "Islamorada, FL",
      phone: "(305) 555 0143",
      address: "81 Overseas Hwy, Islamorada, FL 33036",
      rating: 4.4,
      reviewCount: 512,
      hours: ["Mon–Sat  7am – 3pm", "Sunday  8am – 2pm"],
    },
    categories: ["Cafe", "Breakfast restaurant"],
  },
];

/**
 * Claims that cannot be true of a business we know four things about.
 *
 * Each pattern is something the facts could never support, not merely
 * something that reads badly — the test is honesty, not taste.
 */
const INVENTIONS: [RegExp, string][] = [
  [/\bsince\s+(19|20)\d\d/i, "a founding year"],
  [/\b\d+\+?\s*(years?|yrs?)\b(?!\s*old)/i, "years in business"],
  [/\b(family[- ]run|family[- ]owned|third[- ]generation|generations)\b/i, "family history"],
  [/\b(award[- ]winning|voted|rated\s+(?:the\s+)?best|best\s+in\s+(?:town|the))\b/i, "an award"],
  [/\b(certified|accredited|licen[sc]ed|insured|qualified|registered\s+with)\b/i, "a credential"],
  [/\b(guarantee|warrant(y|ies)|no\s+call[- ]?out\s+fee|free\s+(quote|estimate))\b/i, "a guarantee or price"],
  [/\b(our\s+team\s+of|\d+\s+(staff|barbers|plumbers|stylists)|locations\s+across)\b/i, "a team size"],
  [/"[^"]{15,}"\s*[—-]\s*\w/, "a fabricated quote"],
  [/\b(voted|trusted\s+by|serving\s+over)\s+\d/i, "a customer count"],
];

const main = async () => {
  let failures = 0;

  for (const { facts, categories } of CASES) {
    const brief = await writeBrief(facts, categories, { tone: "friendly" });
    const copy = brief.content.copy;

    const prose = [
      copy.headline,
      copy.subhead ?? "",
      copy.about ?? "",
      copy.closing ?? "",
      ...copy.services.map((s) => `${s.name} ${s.blurb ?? ""}`),
    ].join("  ");

    const caught = INVENTIONS.filter(([pattern]) => pattern.test(prose)).map(
      ([, label]) => label,
    );

    const slug = `demo-${slugify(facts.name)}`;
    const target = siteUrl(slug);
    const { files, template } = renderSite(brief.content, { siteUrl: target });
    await publishSite(slug, files);

    console.log(`\n${"=".repeat(72)}`);
    console.log(`${facts.name}  (${brief.provider}/${brief.model}, ${brief.tokens} tokens, try ${brief.attempts})`);
    console.log(`template: ${template}   routed from "${facts.trade}" -> ${templateFor(facts.trade)}`);
    console.log(`${"=".repeat(72)}`);
    console.log(`headline : ${copy.headline}`);
    console.log(`subhead  : ${copy.subhead ?? "-"}`);
    console.log(`about    : ${copy.about ?? "-"}`);
    console.log(`cta      : ${copy.ctaLabel ?? "-"}`);
    console.log(`closing  : ${copy.closing ?? "-"}`);
    console.log(`services :`);
    for (const service of copy.services) {
      console.log(`   - ${service.name}${service.blurb ? ` — ${service.blurb}` : ""}`);
    }

    if (caught.length) {
      failures += caught.length;
      console.log(`\n  INVENTED: ${caught.join(", ")}`);
    } else {
      console.log(`\n  clean — nothing invented`);
    }

    console.log(`  live: ${target}`);
  }

  console.log(`\n${"=".repeat(72)}`);
  console.log(failures === 0 ? "All clean." : `${failures} invented claim(s) found.`);
};

void main();
