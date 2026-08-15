// Reads the live billing plans off the Clerk instance so the landing page
// can never drift from what the app actually charges. Clerk's backend SDK
// does not expose commerce plans yet, so this uses the same Frontend API
// endpoint that Clerk's own <PricingTable /> calls.

export interface PlanFeature {
  slug: string;
  name: string;
};

export interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Monthly price in cents. */
  amount: number;
  /** Monthly-equivalent price in cents when billed annually, 0 if unset. */
  annualMonthlyAmount: number;
  currency: string;
  freeTrialDays: number | null;
  features: PlanFeature[];
};

/** The publishable key encodes the instance's Frontend API host. */
const frontendApiHost = () => {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const encoded = key.split("_")[2];

  if (!encoded) return null;

  try {
    // Decodes to "<instance>.clerk.accounts.dev$" — the $ is a terminator.
    return Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
  } catch {
    return null;
  }
};

/**
 * Live user-payable plans, cheapest first. Returns [] rather than throwing:
 * a billing outage should degrade the pricing section, not the landing page.
 */
export const getPlans = async (): Promise<Plan[]> => {
  const host = frontendApiHost();

  if (!host) return [];

  try {
    const res = await fetch(
      `https://${host}/v1/commerce/plans?payer_type=user&__clerk_api_version=2025-04-10&_clerk_js_version=5.100.0`,
      { next: { revalidate: 300 } }
    );

    if (!res.ok) return [];

    const body = await res.json();
    const plans: Plan[] = (body?.data ?? []).map(
      (plan: Record<string, unknown>) => ({
        id: String(plan.id ?? plan.slug),
        slug: String(plan.slug ?? ""),
        name: String(plan.name ?? ""),
        description: String(plan.description ?? ""),
        amount: Number(plan.amount ?? 0),
        annualMonthlyAmount: Number(plan.annual_monthly_amount ?? 0),
        // Free plans come back with an empty currency, so `??` is not enough.
        currency: String(plan.currency || "usd"),
        freeTrialDays: plan.free_trial_enabled
          ? Number(plan.free_trial_days ?? 0) || null
          : null,
        features: ((plan.features ?? []) as Record<string, unknown>[]).map(
          (feature) => ({
            slug: String(feature.slug ?? ""),
            name: String(feature.name ?? ""),
          })
        ),
      })
    );

    return plans.sort((a, b) => a.amount - b.amount);
  } catch {
    return [];
  }
};

/** "$20" — plans here are whole-dollar, so trailing .00 is just noise. */
export const formatPrice = (cents: number, currency?: string) => {
  const amount = cents / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
};
