import type { UserIdentity } from "convex/server";

// Mirrors src/lib/entitlements.ts. Duplicated rather than imported because
// convex/ bundles separately and must not reach into the Next.js app tree.
export const FREE_POINTS = 2;
export const PRO_POINTS = 100;
export const MAX_POINTS = 1000;

export const PRO_FEATURE = "generations_100";
export const MAX_FEATURE = "generations_1000";

/**
 * How many credits this caller gets a month.
 *
 * The Next.js side reads this from Clerk's `has({ feature })`, which does not
 * exist inside Convex — all Convex sees is the verified JWT. So the plan has
 * to travel in the token: add a `features` claim to the Clerk JWT template
 * used for Convex (Configure -> JWT Templates -> convex), e.g.
 *
 *   { "features": "{{user.public_metadata.features}}" }
 *
 * Deliberately fail-closed. A missing or unreadable claim yields the FREE
 * allowance, so a misconfigured template under-serves a paying customer (a
 * visible, fixable bug) instead of handing out unlimited generations.
 *
 * Never accept the allowance as a function argument — that is client-supplied
 * and would let anyone mint credits.
 */
export function creditsForIdentity(identity: UserIdentity | null): number {
  if (identity === null) return FREE_POINTS;

  const claims = identity as unknown as Record<string, unknown>;
  const raw = claims.features ?? claims.fea;

  const features = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
      ? raw.split(",").map((f) => f.trim())
      : [];

  if (features.includes(MAX_FEATURE)) return MAX_POINTS;
  if (features.includes(PRO_FEATURE)) return PRO_POINTS;
  return FREE_POINTS;
}
