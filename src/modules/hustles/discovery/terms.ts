/**
 * What we actually type into Google Maps for each trade the user picked.
 *
 * The onboarding slugs ("trades", "beauty") are categories a person
 * recognises, not things Maps searches well — "trades" returns almost
 * nothing, "plumber" returns a town's worth. So each slug fans out into the
 * handful of literal searches that a human doing this by hand would run.
 *
 * Every term is a paid request against the patch, so the lists are short and
 * ordered best-first: the trades most likely to be a one-person business
 * without a website come before the ones that usually have one.
 */

/** Relative imports on purpose — see the note in ./plan.ts. */
import { ONBOARDING_INDUSTRIES } from "../../onboarding/constants";

/**
 * Terms per industry slug, best-first.
 *
 * Kept to five so that truncating the plan removes the weakest search rather
 * than half a trade, and so a single-industry hustle still sweeps wide.
 */
export const INDUSTRY_TERMS: Record<string, readonly string[]> = {
  trades: ["plumber", "electrician", "handyman", "roofing contractor", "hvac contractor"],
  food: ["restaurant", "cafe", "takeout restaurant", "bakery", "food truck"],
  beauty: ["hair salon", "barber shop", "nail salon", "day spa", "beauty salon"],
  fitness: ["gym", "personal trainer", "yoga studio", "martial arts school", "pilates studio"],
  health: ["dentist", "chiropractor", "physical therapist", "optometrist", "massage therapist"],
  auto: ["auto repair shop", "car detailing service", "tire shop", "auto body shop", "car wash"],
  property: ["landscaper", "house cleaning service", "pest control service", "real estate agency", "moving company"],
  events: ["photographer", "caterer", "event venue", "dj service", "wedding planner"],
  retail: ["florist", "gift shop", "boutique", "furniture store", "pet store"],
  professional: ["accountant", "law firm", "insurance agency", "bookkeeping service", "notary public"],
};

/**
 * The ceiling on how many searches one hustle runs.
 *
 * Not a performance limit — each term is billed per tile, so this is the
 * difference between a sweep that costs a few cents and one that costs a few
 * dollars. Eight is enough to cover four trades properly.
 */
export const MAX_TERMS = 8;

/** Falls back to something searchable if a profile has no industries set. */
const DEFAULT_TERMS = ["restaurant", "hair salon", "plumber", "dentist"];

// Widened to string, for the same reason the *_VALUES exports in
// onboarding/constants.ts are: `as const` makes the source a literal tuple,
// and a Set of literals rejects a plain string argument.
const KNOWN = new Set<string>(ONBOARDING_INDUSTRIES.map((industry) => industry.value));

/**
 * The search terms for a set of industry slugs, interleaved.
 *
 * Round-robin rather than concatenated: taken in order, four industries would
 * spend the whole budget on the first one's five terms and never search the
 * other three at all. Interleaving means truncation trims the tail of every
 * trade evenly.
 */
export const termsFor = (industries: readonly string[]): string[] => {
  const lists = industries
    .filter((slug) => KNOWN.has(slug))
    .map((slug) => INDUSTRY_TERMS[slug] ?? []);

  if (lists.length === 0) return DEFAULT_TERMS.slice(0, MAX_TERMS);

  const picked: string[] = [];
  const depth = Math.max(...lists.map((list) => list.length));

  for (let rank = 0; rank < depth && picked.length < MAX_TERMS; rank++) {
    for (const list of lists) {
      const term = list[rank];
      if (term && !picked.includes(term)) picked.push(term);
      if (picked.length >= MAX_TERMS) break;
    }
  }

  return picked;
};
