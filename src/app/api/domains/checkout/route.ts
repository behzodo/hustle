import { auth } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { configured, money, priceNow } from "@/domains";
import { getStripe } from "@/lib/stripe";

/**
 * Taking the money for a domain.
 *
 * The price is worked out here and nowhere else. The browser sends a name and
 * nothing more — the figure it was showing came from a search that may be ten
 * minutes old, and a price posted from a client is a price a client can
 * choose. So this asks the registrar again, prices it again, and charges what
 * it just calculated.
 *
 * The order row is written before the session exists, so a payment always has
 * somewhere to land. The session id is attached immediately afterwards, which
 * is what lets the return route prove that a given payment belongs to a given
 * order rather than taking the browser's word for it.
 */
export async function POST(request: Request) {
  const { userId, getToken } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const token = await getToken({ template: "convex" });
  if (!token) return new Response("Unauthorized", { status: 401 });

  const stripe = getStripe();

  if (!stripe || !configured()) {
    return Response.json(
      { error: "The domain shop is not set up on this environment yet." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const domain = String(body?.domain ?? "").trim().toLowerCase();
  const leadId = String(body?.leadId ?? "");

  if (!domain || !leadId) return new Response("Bad request", { status: 400 });

  // Priced before the order is opened: a name that has been bought by someone
  // else in the meantime should fail here, having charged nothing and having
  // left no half-order behind.
  let priced;

  try {
    priced = await priceNow(domain);
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : "That domain is not available." },
      { status: 409 },
    );
  }

  let orderId: Id<"domains">;

  try {
    orderId = await fetchMutation(
      api.domains.start,
      { leadId: leadId as Id<"leads">, domain, priceCents: priced.priceCents },
      { token },
    );
  } catch (cause) {
    // Every refusal in `start` is something the buyer can act on — the site is
    // not built, they already have a domain, somebody else is buying this one.
    return Response.json(
      { error: reasonFrom(cause) },
      { status: 409 },
    );
  }

  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Stripe fills the session id in; the order id is ours and is what the
      // return route looks the row up by.
      success_url: `${origin}/api/domains/return?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/hustles`,
      client_reference_id: orderId,
      metadata: { orderId, domain, userId },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: priced.priceCents,
            product_data: {
              name: domain,
              // Says what they are actually buying. A line item reading only
              // "joesgym.com" leaves the yearly part to be discovered later.
              description: "Domain name, registered and connected for one year",
            },
          },
        },
      ],
    });

    if (!session.url) throw new Error("Stripe created a session with no payment page.");

    await fetchMutation(
      api.domains.attachSession,
      { orderId, sessionId: session.id },
      { token },
    );

    return Response.json({
      url: session.url,
      orderId,
      price: money(priced.priceCents),
    });
  } catch (cause) {
    // Nothing was charged — the session is what charges. The order is marked
    // so it stops holding the name against the next attempt.
    await fetchMutation(
      api.domains.markFailed,
      { orderId, error: String(cause) },
      { token },
    ).catch(() => {});

    return Response.json(
      { error: cause instanceof Error ? cause.message : "Could not start the payment." },
      { status: 502 },
    );
  }
}

/** The message out of a ConvexError, or a plain one. */
const reasonFrom = (cause: unknown) => {
  const data = (cause as { data?: { message?: string } })?.data;
  if (data?.message) return data.message;

  return cause instanceof Error ? cause.message : "Could not start that order.";
};
