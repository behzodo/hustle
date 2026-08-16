/**
 * Hustle name suggestions, built from the freelancer's own setup.
 *
 * A hustle is a run of sites — one town, one trade, one push — not a single
 * business, so the name that helps six months later is "Leeds dentists", not
 * a random slug. Onboarding already collected the city and the trades they
 * chase, which is exactly what such a name is made of.
 */
import { ONBOARDING_INDUSTRIES } from "@/modules/onboarding/constants";

/**
 * The plural noun a hustle name wants, per industry.
 *
 * The onboarding labels are category headings ("Health", "Beauty & grooming")
 * and read wrong in a name — "Leeds health" is not a list of anyone. These are
 * the businesses you would actually be knocking on.
 */
const TRADE_NOUNS: Record<string, readonly string[]> = {
  trades: ["plumbers", "electricians", "builders"],
  food: ["cafés", "takeaways", "restaurants"],
  beauty: ["barbers", "salons", "nail bars"],
  fitness: ["gyms", "studios", "PTs"],
  health: ["dentists", "clinics", "physios"],
  auto: ["garages", "detailers", "tyre shops"],
  property: ["estate agents", "cleaners", "landscapers"],
  events: ["photographers", "venues", "caterers"],
  retail: ["shops", "boutiques", "florists"],
  professional: ["accountants", "solicitors", "consultants"],
};

/** Reads like a second run at the same list, not a rename. */
const QUALIFIERS = ["round 2", "batch 2", "wave 2", "the rest"] as const;

const ALL_INDUSTRIES: string[] = ONBOARDING_INDUSTRIES.map((i) => i.value);

const capitalise = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

interface Profile {
  city?: string;
  industries?: readonly string[];
}

/**
 * Three suggestions, rotating with `seed` so "Show me more" keeps giving
 * something new rather than reshuffling the same three.
 *
 * Deterministic on purpose — no Math.random, so the server and the first
 * client render agree and React has nothing to complain about.
 */
export const suggestHustleNames = (
  profile: Profile | null | undefined,
  seed = 0,
): string[] => {
  const city = profile?.city?.split(",")[0]?.trim() || "";

  // Falls back to every industry rather than returning nothing: someone who
  // opens this before their profile loads still gets usable names.
  const industries = profile?.industries?.length
    ? [...profile.industries]
    : ALL_INDUSTRIES;

  const names: string[] = [];

  for (let i = 0; i < 3; i++) {
    const step = seed * 3 + i;
    const industry = industries[step % industries.length];
    const nouns = TRADE_NOUNS[industry] ?? ["businesses"];
    const noun = nouns[Math.floor(step / industries.length) % nouns.length];

    // Only add a qualifier once the obvious names are used up, so the first
    // set someone sees is the clean one.
    const lap = Math.floor(step / (industries.length * nouns.length));
    const qualifier =
      lap > 0 ? ` — ${QUALIFIERS[(lap - 1) % QUALIFIERS.length]}` : "";

    names.push(
      city ? `${city} ${noun}${qualifier}` : `${capitalise(noun)}${qualifier}`,
    );
  }

  return names;
};
