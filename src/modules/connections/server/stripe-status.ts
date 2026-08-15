import { getStripe, STRIPE_API_VERSION } from "@/lib/stripe";

export type StripeStatus = "unconfigured" | "none" | "pending" | "ready";

/**
 * How far through Connect onboarding the user is.
 *
 * Read from Accounts v2 rather than v1's `charges_enabled`/`payouts_enabled`
 * booleans: the account is created with v2, and v2 reports each capability
 * separately with a reason ("restricted", "requirements_past_due").
 *
 * Both capabilities have to be active. `stripe_transfers` alone means we can
 * move their 70% into their Stripe balance; without `payouts` it never
 * reaches their bank, and a freelancer wondering where their money went is a
 * support ticket you do not want.
 */
export const getStripeStatus = async (
  accountId?: string
): Promise<StripeStatus> => {
  const stripe = getStripe();

  if (!stripe) return "unconfigured";
  if (!accountId) return "none";

  try {
    const account = await stripe.v2.core.accounts.retrieve(
      accountId,
      { include: ["configuration.recipient"] },
      { apiVersion: STRIPE_API_VERSION }
    );

    const balance =
      account.configuration?.recipient?.capabilities?.stripe_balance;

    const ready =
      balance?.payouts?.status === "active" &&
      balance?.stripe_transfers?.status === "active";

    return ready ? "ready" : "pending";
  } catch {
    // A deleted or unreachable account shouldn't break the page — treat it
    // as not started so they can begin again.
    return "none";
  }
};
