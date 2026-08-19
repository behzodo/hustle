/**
 * What things cost, and what a plan buys.
 *
 * One file, because the number on the pricing page and the number deducted
 * from a balance have to be the same number. They were not before: the old
 * setup priced "a generation" in two places and charged for exactly two of
 * them — creating a project and sending a chat message — while the sweep, the
 * site build and the pitch, which are the product, were free.
 *
 * The unit is a credit and a credit is not a build. It is roughly a cent of
 * our money at the Pro rate, which is what lets one currency price four
 * actions whose real costs differ by two orders of magnitude.
 *
 * Mirrored in convex/lib/pricing.ts, which bundles separately and cannot
 * import from here. Change one, change both — CREDIT_COSTS is checked against
 * its twin by a type in convex/lib/pricing.ts, so a divergence in the numbers
 * that matter fails the build rather than the invoice.
 */

/** Every action that spends. The key is what lands in the ledger. */
export type Chargeable = "sweep" | "site" | "pitch" | "agent";

/**
 * The price list, in credits.
 *
 * Grounded in what each one actually costs us, not in what feels tidy:
 *
 *   sweep   A hunt is up to 48 searches at two billed pages each, on Serper
 *           or — when that is out — on Scrape.do at ten times the credits.
 *           It is the only step that spends real money per unit at a rate we
 *           do not control, so it is the only one priced in double figures.
 *   site    A template render and one free-tier model call. Near enough free
 *           today; priced at one so that a patch of two hundred businesses
 *           is a visible amount of somebody's plan rather than a rounding
 *           error, because it is two hundred live subdomains either way.
 *   pitch   One model call to write, one check, one send. Same order as a
 *           site, and deliberately the same number: a user deciding whether
 *           to pitch should not be doing arithmetic.
 *   agent   The slow lane — a sandbox for three to five minutes and tens of
 *           thousands of OpenAI tokens. Genuinely expensive, and reserved for
 *           businesses that already replied, so it can carry a real price.
 *
 * Not on this list, on purpose:
 *
 *   Creating a hustle. It costs nothing to run and charging for an empty
 *   canvas taxes the act of starting, which is the last thing to tax.
 *
 *   Answering a reply. It runs on a sixty-second cron the user did not press,
 *   and a bill that arrives because somebody else sent an email is a bill
 *   nobody can predict. The pitch that opened the conversation was paid for;
 *   the conversation is included.
 */
export const CREDIT_COSTS: Record<Chargeable, number> = {
  sweep: 10,
  site: 1,
  pitch: 1,
  agent: 5,
};

/** What to call it on screen when a charge is explained or refused. */
export const CHARGE_LABELS: Record<Chargeable, string> = {
  sweep: "Sweep a patch",
  site: "Build a site",
  pitch: "Write and send a pitch",
  agent: "Custom build",
};

/* -------------------------------------------------------------------------- *
 * Plans
 * -------------------------------------------------------------------------- */

export interface Tier {
  slug: string;
  name: string;
  /** Monthly credits. Granted whole at the start of each period. */
  credits: number;
  /** Monthly price in cents. Free is 0 and has no Clerk plan to check. */
  price: number;
  /**
   * The Clerk plan key that grants this tier.
   *
   * A plan key rather than a feature slug, because that is what the plans were
   * actually created with in the dashboard — `has({ plan })`, not
   * `has({ feature })`. Checking a feature would be one indirection better,
   * since features can move between plans without a deploy, and it is worth
   * switching to if features are ever added. Until then this has to match
   * what exists, or every paying customer reads as free.
   */
  planKey?: string;
  /** The one line under the name on the pricing page. */
  pitch: string;
}

/**
 * The ladder, cheapest first.
 *
 * Free's shape is set by the sweep costing ten: twenty-five credits is two
 * sweeps, or one sweep and fifteen sites — enough to work a patch end to end
 * once and see a real site at a real address, which is the only thing that
 * sells this.
 *
 * The paid prices are read off the Clerk dashboard rather than chosen here.
 * Clerk is where a card is actually charged, so a number in this file that
 * disagrees with it is a number that lies to somebody on the way to checkout.
 * Change them there first, then here.
 */
export const TIERS: Tier[] = [
  {
    slug: "free",
    name: "Free",
    credits: 25,
    price: 0,
    pitch: "Sweep one patch and build a handful of sites.",
  },
  {
    slug: "starter",
    name: "Starter",
    credits: 300,
    price: 2000,
    planKey: "credits_300",
    pitch: "A few patches a month, pitched.",
  },
  {
    slug: "pro",
    name: "Pro",
    credits: 1000,
    price: 10000,
    planKey: "credits_1000",
    pitch: "Work a whole town, every month.",
  },
  {
    slug: "max",
    name: "Max",
    credits: 4000,
    price: 50000,
    planKey: "credits_4000",
    pitch: "For running this as the business.",
  },
];

export const FREE_CREDITS = TIERS[0].credits;

const BY_PLAN_KEY = new Map(
  TIERS.filter((tier) => tier.planKey).map((tier) => [tier.planKey as string, tier]),
);

/**
 * Features from the two-tier setup that existed before this file.
 *
 * Anyone subscribed under it keeps a working account without being migrated in
 * the Clerk dashboard first. Mapped to the nearest new tier rather than to
 * their old number, because the old numbers counted generations and these
 * count credits — 100 generations was a month of chat messages, which is
 * Starter's worth of the work people actually do now.
 */
const LEGACY_FEATURES: Record<string, string> = {
  generations_100: "starter",
  generations_1000: "pro",
};

/**
 * Clerk's `has`, narrowed to the two shapes asked for here.
 *
 * A union rather than one object with two optional keys, because Clerk's own
 * type is discriminated: passing `{ plan?: string; feature?: string }` claims
 * both keys may be present at once, which its signature rejects outright. One
 * key per call is also all this ever does.
 */
type HasFn = (params: { plan: string } | { feature: string }) => boolean;

/** The tier this caller is on, highest wins. Free when nothing matches. */
export const tierFor = (has?: HasFn | null): Tier => {
  if (!has) return TIERS[0];

  // Descending, so somebody mid-change between two plans gets the better one.
  for (const tier of [...TIERS].reverse()) {
    if (tier.planKey && has({ plan: tier.planKey })) return tier;
  }

  // Belt and braces: if features with these slugs are ever added alongside the
  // plans, they answer here too and nothing has to be redeployed to notice.
  for (const tier of [...TIERS].reverse()) {
    if (tier.planKey && has({ feature: tier.planKey })) return tier;
  }

  for (const [feature, slug] of Object.entries(LEGACY_FEATURES)) {
    if (has({ feature })) return TIERS.find((t) => t.slug === slug) ?? TIERS[0];
  }

  return TIERS[0];
};

/** Monthly credits the current user is entitled to. */
export const creditsFor = (has?: HasFn | null) => tierFor(has).credits;

/** True on any paid tier — used to hide upgrade prompts. */
export const isPaidPlan = (has?: HasFn | null) => tierFor(has).slug !== "free";

export const tierByPlanKey = (planKey: string) => BY_PLAN_KEY.get(planKey);

/** A tier by our own slug, for the sync that stamps one onto a credits row. */
export const tierBySlug = (slug: string) => TIERS.find((tier) => tier.slug === slug);

/* -------------------------------------------------------------------------- *
 * Credit packs
 * -------------------------------------------------------------------------- */

export interface Pack {
  slug: string;
  name: string;
  credits: number;
  /** One-time price in cents. */
  price: number;
}

/**
 * Top-ups, for the month that runs out before it ends.
 *
 * They exist because the alternative is upgrading a plan to survive one busy
 * week and then paying for it in the three quiet ones. A pack is bought once
 * and, unlike the monthly allowance, never expires — see how `spend` in
 * convex/credits.ts draws down the allowance first, so a pack bought in March
 * is still there in June.
 *
 * Priced a little above the equivalent plan rate on purpose. A subscription
 * should be the cheaper way to buy the same credits, or there is no reason to
 * hold one.
 */
export const PACKS: Pack[] = [
  { slug: "small", name: "250 credits", credits: 250, price: 1500 },
  { slug: "medium", name: "1,000 credits", credits: 1000, price: 4900 },
  { slug: "large", name: "3,000 credits", credits: 3000, price: 11900 },
];

export const packBySlug = (slug: string) => PACKS.find((pack) => pack.slug === slug);

/* -------------------------------------------------------------------------- *
 * Formatting
 * -------------------------------------------------------------------------- */

/** "$19" — plans here are whole-dollar, so a trailing .00 is just noise. */
export const formatPrice = (cents: number, currency = "usd") => {
  const amount = cents / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/** "1,000" — balances are read at a glance and four digits need the comma. */
export const formatCredits = (credits: number) =>
  new Intl.NumberFormat("en-US").format(Math.max(0, Math.floor(credits)));

/**
 * What a plan's credits buy, in the units a user thinks in.
 *
 * Shown on the pricing page instead of the raw number, because "1,000
 * credits" means nothing to somebody who has not read this file and "a
 * hundred sites" means something to everybody.
 */
export const whatItBuys = (credits: number) => ({
  sweeps: Math.floor(credits / CREDIT_COSTS.sweep),
  sites: Math.floor(credits / CREDIT_COSTS.site),
  pitches: Math.floor(credits / CREDIT_COSTS.pitch),
});
