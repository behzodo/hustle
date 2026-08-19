import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { fulfil } from "@/domains/fulfil";
import { getStripe } from "@/lib/stripe";

/**
 * Finishing an order that was paid for and never bought.
 *
 * The one hole the buy flow leaves. Fulfilment happens on the page the buyer
 * returns to, so a buyer who pays and closes the tab before it loads leaves an
 * order on `paid` — their money taken, no domain, and nothing running that
 * will notice. This is the button that finishes it.
 *
 * Safe to press repeatedly. The registrar takes the order id as an
 * idempotency key, so a domain already bought under this order comes back
 * rather than being bought again, and the outcome is written as a terminal
 * status either way.
 *
 * Only `paid` orders. A `pending` one was never charged and has no payment to
 * fulfil against; a `live` one is done; a `failed` one has already been
 * refunded, and re-running it would buy a domain nobody has paid for.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const { userId, getToken } = await auth();

  if (!userId) return new Response("Unauthorized", { status: 401 });

  const token = await getToken({ template: "convex" });
  if (!token) return new Response("Unauthorized", { status: 401 });

  const stripe = getStripe();

  if (!stripe) {
    return Response.json({ error: "Stripe is not configured here." }, { status: 503 });
  }

  const order = await fetchQuery(
    api.domains.get,
    { orderId: orderId as Id<"domains"> },
    { token },
  );

  if (!order) return new Response("Not found", { status: 404 });

  if (order.status === "live") {
    return Response.json({ ok: true, domain: order.domain, alreadyDone: true });
  }

  if (order.status !== "paid") {
    return Response.json(
      { error: "That order was never paid for, so there is nothing to finish." },
      { status: 409 },
    );
  }

  if (!order.sessionId) {
    return Response.json(
      { error: "That order has no payment attached to it." },
      { status: 409 },
    );
  }

  // Re-proved against Stripe rather than trusted from the row. The status says
  // a payment succeeded; this is what confirms the payment is still there and
  // has not already been refunded by hand.
  const session = await stripe.checkout.sessions
    .retrieve(order.sessionId)
    .catch(() => null);

  if (!session || session.payment_status !== "paid") {
    return Response.json(
      { error: "Stripe has no completed payment for that order." },
      { status: 409 },
    );
  }

  const result = await fulfil({
    orderId: orderId as Id<"domains">,
    token,
    domain: order.domain,
    slug: order.slug,
    priceCents: order.priceCents,
    paymentIntent: session.payment_intent ? String(session.payment_intent) : null,
    stripe,
  });

  if (result.ok) return Response.json({ ok: true, domain: result.domain });

  return Response.json(
    { error: result.error, refunded: result.refunded },
    { status: 502 },
  );
}
