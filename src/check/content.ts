import type { SiteContent } from "@/blocks/types";

/**
 * Reading the copy before anybody else does.
 *
 * None of this needs a model or a browser. Two thirds of what goes wrong on a
 * generated page is measurable — a headline too long for type set at eight
 * times body size, a service name that will not fit the column it is put in, a
 * subhead that repeats the headline it sits under — and measuring is instant
 * and free where asking costs a call and a second.
 *
 * The exception, and the reason this file exists rather than living in the
 * schema, is the invention check. Length is a layout problem; a claim we
 * cannot support is the pitch failing, and it has to be caught on every site
 * rather than in a test that ran once on three of them.
 */

export type Severity =
  /** The field cannot be salvaged. Remove it and render without. */
  | "drop"
  /** Ask the model for this field again, told what was wrong. */
  | "rewrite";

export interface Problem {
  /** What is wrong with, e.g. "headline", "services[2].name", "photo". */
  field: string;
  severity: Severity;
  message: string;
}

/**
 * Claims a scraped map listing cannot support.
 *
 * Ran as a test while the prompt was being written and kept as a check because
 * a prompt is a request and this is a guarantee. A model that obeys nineteen
 * times in twenty is a model that puts a false certification on the twentieth
 * business, and that one is the one that reads it.
 *
 * Every pattern here is a thing we could not possibly know from a name, a
 * category, a phone number and a star rating.
 */
const INVENTIONS: [RegExp, string][] = [
  [
    /\b(?:since|established|est\.|founded|opened|trading\s+since)\s+(?:in\s+)?(?:19|20)\d\d/i,
    "claims a founding year",
  ],
  [/\b\d+\+?\s*(years?|yrs?)\b(?!\s*old)/i, "claims years in business"],
  [
    /\b(family[- ]run|family[- ]owned|third[- ]generation|generations of)\b/i,
    "claims family history",
  ],
  [
    /\b(award[- ]winning|award[- ]nominated|voted\s|rated\s+(?:the\s+)?best|best\s+in\s+(?:town|the)|\d+[- ]star\s+rated|top[- ]rated)\b/i,
    "claims an award",
  ],
  [
    /\b(certified|accredited|licen[sc]ed|insured|fully\s+qualified|registered\s+with)\b/i,
    "claims a credential",
  ],
  // Plurals matter, and the first version of this line did not have them:
  // `free\s+estimate\b` does not match "free estimates", because there is no
  // word boundary between the noun and its s. It went unnoticed until a repair
  // pass put "customers can request free estimates" onto a page that had just
  // been corrected for exactly this — which is the argument for checking
  // rather than asking, applied to the checker itself.
  [
    /\b(guarantees?|guaranteed|warrant(?:y|ies|ied)|no\s+call[- ]?out\s+fee|free\s+(?:quotes?|estimates?|consultations?|callouts?|delivery)|money[- ]back|price\s+match)\b/i,
    "claims a guarantee or a price",
  ],
  [
    /\b(our\s+team\s+of\s+\d|\d+\s+(?:staff|barbers|plumbers|stylists|technicians)|locations\s+across)\b/i,
    "claims a team size",
  ],
  [/\b(trusted\s+by|serving\s+over|more\s+than)\s+[\d,]+/i, "claims a customer count"],
  [/"[^"]{15,}"\s*[—–-]\s*\w/, "contains a quote nobody said"],
];

/**
 * Ceilings that come from the templates rather than from taste.
 *
 * The headline is set with `clamp(2.5rem, 8vw, 5.5rem)` in three of the four,
 * so it is the one field where an extra clause is not a longer sentence, it is
 * a hero three lines deep that pushes everything below the fold. Service names
 * sit in a fixed column in plumbline and are `white-space: nowrap` in table.
 */
const HEADLINE_MAX = 58;
const SERVICE_NAME_MAX = 32;
const ABOUT_MIN = 40;

/** The first few words, for spotting one field that repeats another. */
const opening = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).slice(0, 5).join(" ");

export const checkContent = ({ business, copy }: SiteContent): Problem[] => {
  const problems: Problem[] = [];

  const say = (field: string, severity: Severity, message: string) =>
    problems.push({ field, severity, message });

  /* ---- claims we cannot support ---- */

  const fields: [string, string | undefined][] = [
    ["headline", copy.headline],
    ["subhead", copy.subhead],
    ["about", copy.about],
    ["closing", copy.closing],
    ...copy.services.map(
      (service, index) =>
        [`services[${index}].blurb`, service.blurb] as [string, string | undefined],
    ),
  ];

  for (const [field, text] of fields) {
    if (!text) continue;

    for (const [pattern, complaint] of INVENTIONS) {
      if (pattern.test(text)) say(field, "rewrite", `${complaint} — nothing we know supports it`);
    }
  }

  /* ---- things that will not fit ---- */

  if (copy.headline.length > HEADLINE_MAX) {
    say(
      "headline",
      "rewrite",
      `${copy.headline.length} characters; the hero sets this very large and it needs to be under ${HEADLINE_MAX}`,
    );
  }

  copy.services.forEach((service, index) => {
    if (service.name.length > SERVICE_NAME_MAX) {
      say(
        `services[${index}].name`,
        "rewrite",
        `${service.name.length} characters; a service name has to fit one column and needs to be under ${SERVICE_NAME_MAX}`,
      );
    }
  });

  /* ---- things that read badly ---- */

  if (copy.services.length < 2) {
    say("services", "rewrite", "a list of one reads as an oversight; give three or four");
  }

  if (copy.about !== undefined && copy.about.length < ABOUT_MIN) {
    say("about", "drop", "too short to be worth a section of its own");
  }

  if (copy.subhead && opening(copy.subhead) === opening(copy.headline)) {
    say("subhead", "rewrite", "starts the same way as the headline directly above it");
  }

  if (copy.closing && copy.subhead && opening(copy.closing) === opening(copy.subhead)) {
    say("closing", "drop", "repeats the subhead");
  }

  const name = opening(business.name);
  if (name && opening(copy.headline) === name && copy.headline.length < 30) {
    say("headline", "rewrite", "is just the business name, which the page already shows");
  }

  /* ---- facts that contradict what we hold ---- */

  if (!business.phone && /\b(call|phone|ring|dial)\b/i.test(copy.ctaLabel ?? "")) {
    say("ctaLabel", "rewrite", "says to call, but we have no phone number to show");
  }

  return problems;
};
