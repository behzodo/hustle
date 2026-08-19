import "server-only";

import { fetchMutation } from "convex/nextjs";
import type Stripe from "stripe";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

import { buy } from "./index";

/**
 * Turning a payment into a domain.
 *
 * Shared by the two places that can do it: the page somebody lands on after
 * paying, and the retry on the domains list for an order that never got that
 * far. They are the same work — the only difference is who is waiting.
 *
 * Everything here is safe to run twice. `buy` hands the order id to the
 * registrar as an idempotency key, so a second call returns the first call's
 * purchase rather than making another; and both endings write a terminal
 * status, so a third call has nothing left to do.
 *
 * The refund is the part worth being careful about. The registration is the
 * only step that spends money, and it either happened or it did not — so
 * reaching the catch means nothing was bought and the charge should go back
 * before anybody has to ask for it.
 */

export interface Fulfilment {
  ok: boolean;
  /** The domain, when it was bought. */
  domain?: string;
  error?: string;
  refunded?: boolean;
}

export const fulfil = async ({
  orderId,
  token,
  domain,
  slug,
  priceCents,
  paymentIntent,
  stripe,
}: {
  orderId: Id<"domains">;
  /** The buyer's Convex token. Every write below is theirs to make. */
  token: string;
  domain: string;
  slug: string;
  /** What they paid. The ceiling on what we will spend buying it. */
  priceCents: number;
  /** What to give back if the registration fails. */
  paymentIntent: string | null;
  stripe: Stripe;
}): Promise<Fulfilment> => {
  try {
    const bought = await buy({ domain, slug, orderId, maxCostCents: priceCents });

    await fetchMutation(
      api.domains.markLive,
      {
        orderId,
        costCents: bought.costCents,
        ...(bought.hostnameId ? { hostnameId: bought.hostnameId } : {}),
        ...(bought.sslStatus ? { sslStatus: bought.sslStatus } : {}),
      },
      { token },
    );

    return { ok: true, domain: bought.domain };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);

    const refunded = paymentIntent
      ? await stripe.refunds
          .create({ payment_intent: paymentIntent })
          .then(() => true)
          .catch((refundCause) => {
            // Said loudly rather than swallowed. A failed refund is the one
            // outcome here that leaves somebody out of pocket with nothing
            // running to fix it.
            console.error(`[domains] could not refund ${orderId}:`, refundCause);
            return false;
          })
      : false;

    await fetchMutation(
      api.domains.markFailed,
      { orderId, error, refunded },
      { token },
    ).catch(() => {});

    console.error(`[domains] ${domain} failed after payment:`, error);

    return { ok: false, error, refunded };
  }
};
