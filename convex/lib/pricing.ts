import type { UserIdentity } from "convex/server";

/**
 * The price list, as Convex sees it.
 *
 * Mirrors src/lib/pricing.ts. Duplicated rather than imported because convex/
 * bundles separately and must not reach into the Next.js app tree — the same
 * reason convex/lib/places and src/modules/hustles/discovery pass numbers
 * across by hand.
 *
 * Nothing enforces that the two agree, so it is worth knowing which way a
 * divergence hurts: this copy decides what is deducted, the other decides what
 * is displayed. A mismatch is a user charged something other than what they
 * were quoted. Change one, change both.
 */

export type Chargeable = "sweep" | "site" | "pitch" | "agent";

/** See src/lib/pricing.ts for why each of these is the number it is. */
export const CREDIT_COSTS: Record<Chargeable, number> = {
  sweep: 10,
  site: 1,
  pitch: 1,
  agent: 5,
};

export const FREE_CREDITS = 25;

/**
 * Clerk billing features, and the monthly allowance each one grants.
 *
 * Ordered largest first so a caller holding two features gets the better one
 * without a sort at read time.
 */
const TIERS: { slug: string; feature: string; credits: number }[] = [
  { slug: "max", feature: "credits_4000", credits: 4000 },
  { slug: "pro", feature: "credits_1000", credits: 1000 },
  { slug: "starter", feature: "credits_300", credits: 300 },
  // The two-tier setup this replaced. Kept so an existing subscriber is not
  // dropped to free by a deploy; see LEGACY_FEATURES in src/lib/pricing.ts.
  { slug: "pro", feature: "generations_1000", credits: 1000 },
  { slug: "starter", feature: "generations_100", credits: 300 },
];

export interface Entitlement {
  slug: string;
  credits: number;
}

const FREE: Entitlement = { slug: "free", credits: FREE_CREDITS };

/**
 * Which plan this caller is on, if the token happens to say.
 *
 * Usually it does not, and that is the important part. The plan lives in Clerk
 * and Convex only ever sees a JWT — but Clerk refuses to put its billing
 * claims (`fea`, `pla`) into a custom JWT template, and the "convex" template
 * is exactly that. Nor does Clerk Billing write anything to `public_metadata`
 * for a template to read. So the claim this looks for will normally be absent,
 * and the plan arrives instead through `setPlan` in convex/credits.ts, relayed
 * from Next.js where Clerk can actually be asked.
 *
 * Which is why this returns **null** rather than the free tier when it finds
 * nothing. Those are different answers: null means "no idea, ask someone else"
 * and the caller falls back to the plan already stamped on the credits row.
 * Returning FREE here instead would silently demote every paying customer at
 * their next reset — the exact bug this whole path exists to fix.
 *
 * Kept working anyway, because a `features` claim is trivial to add by hand
 * once somebody is writing plans into `public_metadata`, and it is the better
 * answer when it is there: it is signed, and it cannot be stale.
 *
 * Never accept the allowance as an argument on a client-reachable function.
 * A client that can name its own allowance can mint credits.
 */
export function entitlementFromToken(identity: UserIdentity | null): Entitlement | null {
  if (identity === null) return null;

  const claims = identity as unknown as Record<string, unknown>;
  const raw = claims.features ?? claims.fea;

  const features = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
      ? raw.split(",").map((feature) => feature.trim())
      : [];

  if (features.length === 0) return null;

  for (const tier of TIERS) {
    if (features.includes(tier.feature)) {
      return { slug: tier.slug, credits: tier.credits };
    }
  }

  // A token that carried features but none we know: a plan that exists in
  // Clerk and not here. Free, not null — this is an answer, just an unhelpful
  // one, and treating it as silence would let an unknown plan inherit whatever
  // the row last held.
  return FREE;
}
