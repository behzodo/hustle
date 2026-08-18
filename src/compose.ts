import "server-only";

import { USES_PHOTO } from "@/blocks/templates";
import type { BusinessFacts, SiteContent, TemplateName } from "@/blocks/types";
import { repairCopy, writeBrief } from "@/brief";
import { checkContent, checkPhoto, type Problem } from "@/check";
import type { ProviderName } from "@/ai";

/**
 * Write, check, fix, repeat — and know when to stop.
 *
 * The loop is the whole of it. A model given rules follows them nearly always,
 * and "nearly always" across a thousand businesses is dozens of pages carrying
 * a claim we cannot support. So nothing it writes is trusted: it is measured,
 * and where it fails the measurement it is told exactly which field and exactly
 * why, and asked again.
 *
 * Three things make this cheap enough to run on every site.
 *
 * The photograph is judged once. Its verdict does not change when a headline is
 * rewritten, and it is the only step here that costs one of a very small daily
 * allowance of image calls.
 *
 * The re-check after a repair is free. `checkContent` is regular expressions
 * and string lengths — no model, no network — so the loop's cost is one call
 * per repair rather than one call per iteration.
 *
 * And it gives up. Two repairs, then whatever is still wrong is either dropped
 * or published with the problem recorded against it. A loop that will not stop
 * is worse than a page with a long headline: it burns the quota that the next
 * two hundred businesses needed, on one that was never going to converge.
 */

/** How many times the model is asked to correct itself. */
const MAX_REPAIRS = 2;

export interface Composed {
  content: SiteContent;
  template: TemplateName;
  /** Everything ever found, across every attempt. */
  problems: Problem[];
  /** What was still wrong when we stopped asking. Usually empty. */
  unresolved: Problem[];
  /** What the photograph turned out to be, when one was kept. */
  photo?: string;
  /** Why the photo was not judged, when it was not. */
  photoSkipped?: string;
  repairs: number;
  tokens: number;
  provider: ProviderName;
}

export interface ComposeOptions {
  tone?: string;
  order?: ProviderName[];
}

export const composeSite = async (
  facts: BusinessFacts,
  categories: string[],
  template: TemplateName,
  options: ComposeOptions = {},
): Promise<Composed> => {
  const first = await writeBrief(facts, categories, options);

  // Once, before the loop. Nothing a repair does to the copy can change what
  // is in the photograph, and this is the expensive half of checking.
  const photo = USES_PHOTO[template]
    ? await checkPhoto(facts.photo)
    : { keep: false, skipped: `${template} shows no photo` as string | undefined, subject: undefined, problem: undefined };

  const business: BusinessFacts = photo.keep ? facts : { ...facts, photo: undefined };

  let content: SiteContent = { business, copy: first.content.copy };
  let problems: Problem[] = [...(photo.problem ? [photo.problem] : []), ...checkContent(content)];
  let tokens = first.tokens;
  let provider = first.provider;
  let repairs = 0;

  const all: Problem[] = [...problems];

  while (repairs < MAX_REPAIRS) {
    const rewrites = problems.filter((problem) => problem.severity === "rewrite");
    if (rewrites.length === 0) break;

    repairs += 1;

    const fixed = await repairCopy(content, rewrites, options);

    content = { business, copy: fixed.copy };
    tokens += fixed.tokens;
    provider = fixed.provider;

    // The photo problem is carried forward by hand rather than re-derived:
    // it belongs to the business, not to this draft of the copy.
    problems = [...(photo.problem ? [photo.problem] : []), ...checkContent(content)];
    all.push(...problems.filter((problem) => problem.field !== "photo"));
  }

  // Anything left that can simply be taken off the page, is. Every template
  // renders without any of these, and a section that is quietly absent beats
  // one that is present and wrong.
  const cleaned: SiteContent = { business, copy: { ...content.copy } };

  for (const problem of problems) {
    if (problem.severity !== "drop") continue;
    if (problem.field === "about") cleaned.copy.about = undefined;
    if (problem.field === "closing") cleaned.copy.closing = undefined;
    if (problem.field === "subhead") cleaned.copy.subhead = undefined;
  }

  return {
    content: cleaned,
    template,
    // Deduplicated: the same complaint surviving two rounds is one problem
    // that was not fixed, not two problems.
    problems: dedupe(all),
    unresolved: problems.filter((problem) => problem.severity === "rewrite"),
    photo: photo.keep ? photo.subject : undefined,
    photoSkipped: photo.skipped,
    repairs,
    tokens,
    provider,
  };
};

const dedupe = (problems: Problem[]): Problem[] => {
  const seen = new Set<string>();

  return problems.filter((problem) => {
    const key = `${problem.field}|${problem.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
