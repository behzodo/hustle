import type { Template, TemplateName } from "../types";

import { bloom } from "./bloom";
import { forge } from "./forge";
import { plumbline } from "./plumbline";
import { table } from "./table";

export const TEMPLATES: Record<TemplateName, Template> = {
  forge,
  bloom,
  plumbline,
  table,
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES) as TemplateName[];

/**
 * Whether a template puts the photograph on the page.
 *
 * plumbline does not, and never will: its hero is the phone number. Checking a
 * photograph it is not going to show spends one of a very small daily
 * allowance of image calls to answer a question nobody asked. See
 * src/check/photo.ts for how small.
 */
export const USES_PHOTO: Record<TemplateName, boolean> = {
  forge: true,
  bloom: true,
  table: true,
  plumbline: false,
};

/**
 * Which look a trade gets.
 *
 * Matched on words rather than on a list of exact categories, because the
 * category is whatever Google has on the listing — "Hair salon", "Beauty
 * salon", "Hairdresser", "Barber shop" and "Unisex hairdresser" are five
 * spellings of one shop, and a lookup table of exact strings is a table that
 * is wrong the first time a listing says something new.
 *
 * Order matters below: the first hit wins, so the narrower words are checked
 * before the broader ones. "Barber" has to be tested before "hair" or every
 * barber in the country comes out looking like a nail bar.
 */
const ROUTES: [TemplateName, RegExp][] = [
  [
    "forge",
    /\b(gym|fitness|crossfit|weight|boxing|martial|mma|jiu|karate|barber|tattoo|piercing|garage|mechanic|autobody|auto\s?repair|tyre|tire|mot|car\s?wash|detailing|motorcycle)\b/i,
  ],
  [
    "table",
    /\b(caf|coffee|espresso|restaurant|bistro|brasserie|diner|bakery|baker|patisserie|pizza|pizzeria|takeaway|take-?out|deli|delicatessen|sandwich|burger|kebab|sushi|ramen|noodle|curry|tapas|grill|steakhouse|bar|pub|tavern|brewery|winery|catering|caterer|ice\s?cream|juice|smoothie|butcher|greengrocer|food)\b/i,
  ],
  [
    "bloom",
    /\b(salon|hair|hairdress|nail|manicure|pedicure|beauty|beautician|spa|massage|wax|lash|brow|aesthet|skin|facial|wellness|yoga|pilates|florist|flower|therapy|therapist|physio|chiroprac|acupunctur|dental|dentist|orthodon|optician|clinic|podiatr)\b/i,
  ],
  [
    "plumbline",
    /\b(plumb|electric|roof|build|construct|locksmith|heating|boiler|gas|carpent|joiner|plaster|paint|decorat|tiler|landscap|garden|tree|fenc|pav|driveway|pest|drain|glaz|window|door|hvac|air\s?con|handyman|clean|removal|skip|scaffold|survey|architect|solar|insulat|flooring|kitchen\s?fitt|bathroom)\b/i,
  ],
];

/**
 * Picks a template from whatever the listing called the business.
 *
 * Takes every category rather than one, because Google returns them best-first
 * and the first is not always the most useful — a barber is routinely listed
 * as "Beauty salon, Barber shop", and the second word is the one that
 * describes the room.
 *
 * Falls back to plumbline: it is the least decorated of the four and the one
 * that survives knowing nothing about a business, since its whole structure is
 * a name, a number and a list.
 */
export const templateFor = (...trades: (string | undefined)[]): TemplateName => {
  const text = trades.filter(Boolean).join(" ");

  for (const [name, pattern] of ROUTES) {
    if (pattern.test(text)) return name;
  }

  return "plumbline";
};

export { bloom, forge, plumbline, table };
