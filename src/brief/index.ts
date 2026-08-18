import "server-only";

import { askJson, type ProviderName } from "@/ai";
import type { BusinessFacts, SiteContent } from "@/blocks/types";

import { BRIEF_FORMAT, BRIEF_SYSTEM, toneNote } from "./prompt";
import { BriefCopySchema } from "./schema";

/**
 * The brief: one model call that turns a scraped listing into a site's words.
 *
 * This is the whole of the fast lane's intelligence. Everything after it is
 * deterministic — a template renders, a bucket stores, a worker serves — so
 * this call is the only place the output can be good or bad, and the only
 * place it can be wrong about a real business.
 *
 * Hence the schema below rather than a free-form answer. The limits are not
 * tidiness: `headline` is set at seven or eight times body size in every
 * template, and a model that returns a sentence there produces a page that
 * looks broken rather than a page that reads badly. Length is a layout
 * constraint here, so it is enforced where layout cannot fix it.
 */

/* The shape itself lives in ./schema, shared with the repair pass. */

export interface BriefOptions {
  /** Tone slug from the user's profile — see prompt.ts. */
  tone?: string;
  /** Overrides the provider preference order. */
  order?: ProviderName[];
}

export interface Brief {
  content: SiteContent;
  provider: ProviderName;
  model: string;
  tokens: number;
  attempts: number;
}

/**
 * Everything known, written out for the model.
 *
 * Absent fields are omitted rather than sent as "unknown". A model shown
 * `rating: unknown` will write around the gap and sometimes into it; a model
 * shown nothing has nothing to write around. The closing line is a
 * belt-and-braces restatement of the rule in the system prompt, because it is
 * the last thing read before generation and it is the one that costs money to
 * get wrong.
 */
const describeBusiness = (facts: BusinessFacts, categories: string[]) => {
  const lines: string[] = [
    `Name: ${facts.name}`,
    `Kind of business: ${facts.trade}`,
  ];

  const others = categories.filter((c) => c && c !== facts.trade);
  if (others.length) lines.push(`Also listed as: ${others.join(", ")}`);
  if (facts.town) lines.push(`Area: ${facts.town}`);
  if (facts.address) lines.push(`Address: ${facts.address}`);
  if (facts.phone) lines.push(`Phone: ${facts.phone}`);
  if (facts.rating !== undefined) lines.push(`Star rating: ${facts.rating} out of 5`);
  if (facts.reviewCount !== undefined) lines.push(`Number of reviews: ${facts.reviewCount}`);
  if (facts.hours?.length) lines.push(`Opening hours:\n  ${facts.hours.join("\n  ")}`);

  return lines.join("\n");
};

export const writeBrief = async (
  facts: BusinessFacts,
  categories: string[] = [],
  options: BriefOptions = {},
): Promise<Brief> => {
  const user = [
    "Here is everything known about the business.",
    "",
    describeBusiness(facts, categories),
    "",
    `Voice: ${toneNote(options.tone)}`,
    "",
    BRIEF_FORMAT,
    "",
    "Nothing above this line may be added to. If a fact is not listed, it is not known, and you must not write a sentence that depends on it.",
  ].join("\n");

  const { value, provider, model, tokens, attempts } = await askJson(BriefCopySchema, {
    system: BRIEF_SYSTEM,
    user,
    // Room for a reasoning model to think before it writes — see providers.ts.
    maxTokens: 3000,
    // The hard part of this job is obedience, not reasoning: the rules are
    // explicit and the output is six short fields. Thinking about it longer
    // does not make it truer, and it triples the time and the tokens.
    thinking: "low",
    // Low enough that the rules hold, high enough that a thousand plumbers do
    // not get a thousand copies of the same headline.
    temperature: 0.8,
    order: options.order,
  });

  return {
    content: { business: facts, copy: value },
    provider,
    model,
    tokens,
    attempts,
  };
};

export { repairCopy, type Repaired } from "./repair";
export { BriefCopySchema, type BriefCopy } from "./schema";
