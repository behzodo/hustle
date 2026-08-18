import "server-only";

import { askJson, type ProviderName } from "@/ai";
import type { SiteContent } from "@/blocks/types";
import type { Problem } from "@/check/content";

import { BriefCopySchema, type BriefCopy } from "./schema";
import { BRIEF_FORMAT, BRIEF_SYSTEM } from "./prompt";

/**
 * Asking again, about the parts that were wrong.
 *
 * Not a second attempt at the whole job. The model is shown what it wrote and
 * the specific complaint against each field, and told to leave everything else
 * exactly as it is — because most of what it produced was fine, and a fresh
 * generation would throw away four good services to fix one long headline.
 *
 * The complaints are the check's own words. That is deliberate: "58 characters;
 * the hero sets this very large" is a fixable instruction, where "invalid" is
 * an invitation to guess. A model told precisely what is wrong usually gets it
 * on the first correction, which is why the loop around this is short.
 */

const REPAIR_SYSTEM = `${BRIEF_SYSTEM}

You are now correcting copy you already wrote. You will be given the current JSON and a list of what is wrong with specific fields.

Change only the fields named in the complaints. Every other field must come back exactly as it was, character for character. Do not improve anything you were not asked about.

If a complaint says something cannot be supported by the facts, the fix is to remove the claim, not to soften it. "Licensed and insured" does not become "professional and reliable" — the whole sentence goes, and what remains is what was true without it.`;

export interface Repaired {
  copy: BriefCopy;
  provider: ProviderName;
  tokens: number;
}

export const repairCopy = async (
  content: SiteContent,
  problems: Problem[],
  options: { tone?: string; order?: ProviderName[] } = {},
): Promise<Repaired> => {
  const complaints = problems
    .map((problem) => `- ${problem.field}: ${problem.message}`)
    .join("\n");

  const user = [
    `This is the copy you wrote for ${content.business.name}, a ${content.business.trade}${
      content.business.town ? ` in ${content.business.town}` : ""
    }.`,
    "",
    JSON.stringify(content.copy, null, 2),
    "",
    "What is wrong with it:",
    complaints,
    "",
    "Return the whole object, with those fields corrected and everything else unchanged.",
    "",
    BRIEF_FORMAT,
  ].join("\n");

  const { value, provider, tokens } = await askJson(BriefCopySchema, {
    system: REPAIR_SYSTEM,
    user,
    maxTokens: 3000,
    // Lower than the first pass. That one wanted a thousand plumbers to get a
    // thousand different headlines; this one wants one specific instruction
    // followed, and variety is what put it here.
    temperature: 0.4,
    thinking: "low",
    order: options.order,
  });

  return { copy: value, provider, tokens };
};
