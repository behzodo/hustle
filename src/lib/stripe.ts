import Stripe from "stripe";

// Platform account is in the Netherlands, so Connect is available and the
// default currency is EUR.
export const PLATFORM_COUNTRY = "NL";

/** Hustle's cut of every invoice, in basis points of the total. */
export const PLATFORM_FEE_BPS = 3000; // 30%

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Accounts v2 lives on the preview channel and refuses requests without an
// explicit version header.
export const STRIPE_API_VERSION = "2026-06-24.preview";

export const isStripeConfigured = () => Boolean(STRIPE_SECRET_KEY);

/**
 * Server-side Stripe client, or null when the key is missing.
 *
 * Returning null rather than throwing at import time keeps the connections
 * page renderable on an environment that has not been given keys yet.
 */
export const getStripe = () =>
  STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

/**
 * The application fee for a given invoice total, in the smallest currency
 * unit. Rounded down so we never take more than the agreed share.
 */
export const platformFeeFor = (amount: number) =>
  Math.floor((amount * PLATFORM_FEE_BPS) / 10_000);
