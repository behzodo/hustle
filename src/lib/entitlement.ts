import "server-only";

import { auth } from "@clerk/nextjs/server";

import { syncEntitlement } from "@/inngest/convex";
import { tierFor } from "@/lib/pricing";

/**
 * Teaching Convex what somebody is paying for.
 *
 * The plan lives in Clerk and the balance lives in Convex, and there is no
 * direct line between them. Convex sees a JWT and nothing else, and Clerk will
 * not put its billing claims into a custom JWT template — which is what the
 * "convex" template is. The `features` claim the old code read for was never
 * going to arrive, so every subscriber was quietly served the free allowance.
 *
 * Here is the line that does exist: Next.js can ask Clerk directly, and it can
 * reach Convex through the shared secret. So the answer is fetched on this
 * side and relayed. The credits row keeps the last answer, which is also what
 * lets the build queue and the Stripe webhook price their work without a user
 * token of their own.
 *
 * It runs on page loads, so it must never make a page slower or break one —
 * hence `after()` at the call site and the swallowed error below. A sync that
 * misses is corrected by the next navigation; a sync that throws would take
 * down the workspace over a billing lookup.
 */
export const syncPlan = async () => {
  const { userId, has } = await auth();

  if (!userId) return null;

  const tier = tierFor(has);

  try {
    return await syncEntitlement({
      userId,
      plan: tier.slug,
      credits: tier.credits,
    });
  } catch (cause) {
    console.error("[credits] could not sync the plan:", cause);
    return null;
  }
};
