import "server-only";

import { USES_PHOTO } from "@/blocks/templates";
import type { SiteContent, TemplateName } from "@/blocks/types";

import { checkContent, type Problem, type Severity } from "./content";
import { checkPhoto, type PhotoCheck } from "./photo";

export { checkContent, checkPhoto };
export type { Problem, Severity };

export interface Checked {
  /** The content with anything unsalvageable removed. Safe to render. */
  content: SiteContent;
  /** Everything found, including what was dropped. */
  problems: Problem[];
  /** What a rewrite should be asked to fix. Empty means nothing is worth asking. */
  rewrites: Problem[];
  /** What the photograph turned out to be, when one was kept. */
  photo?: string;
  /** Set when a check could not run — an absence of findings, not a pass. */
  skipped?: string;
}

/**
 * Everything that looks at a site before it goes up.
 *
 * Two passes and they do different jobs. The measurable one is free and runs
 * always; the one that needs eyes runs only when there is a photograph, which
 * is the one thing on the page nobody here has seen.
 *
 * The distinction that matters is between a problem worth another model call
 * and a problem worth deleting. Dropping is instant, free, and every template
 * is built to render without any given section — so a bad photograph is simply
 * removed, and only the copy, which cannot be removed without leaving a blank
 * page, is worth going back to the model about.
 */
export const checkSite = async (
  content: SiteContent,
  template?: TemplateName,
): Promise<Checked> => {
  const problems = checkContent(content);

  // Not asked at all when the chosen template does not show a photograph. The
  // eyes are the scarcest thing in this stack — twenty calls a day — and this
  // is the difference between spending one per site and one per site that has
  // somewhere to put the answer.
  const photo: PhotoCheck =
    template && !USES_PHOTO[template]
      ? { keep: false, skipped: `${template} shows no photo` }
      : await checkPhoto(content.business.photo);

  if (photo.problem) problems.push(photo.problem);

  // Applied here rather than left to the caller: a `Checked` whose content
  // still carries the thing that was just condemned is an invitation to
  // publish it by forgetting one line.
  const cleaned: SiteContent = {
    business: photo.keep
      ? content.business
      : { ...content.business, photo: undefined },
    copy: { ...content.copy },
  };

  for (const problem of problems) {
    if (problem.severity !== "drop") continue;

    if (problem.field === "about") cleaned.copy.about = undefined;
    if (problem.field === "closing") cleaned.copy.closing = undefined;
    if (problem.field === "subhead") cleaned.copy.subhead = undefined;
  }

  return {
    content: cleaned,
    problems,
    rewrites: problems.filter((problem) => problem.severity === "rewrite"),
    photo: photo.keep ? photo.subject : undefined,
    skipped: photo.skipped,
  };
};
