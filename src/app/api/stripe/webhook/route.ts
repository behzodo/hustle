import type Stripe from "stripe";

import { creditPack } from "@/inngest/convex";
import { getStripe } from "@/lib/stripe";

/**
 * What Stripe tells us happened.
 *
 * One route for the platform account's events. Right now it handles exactly
 * one: a credit pack was paid for. It is the moment money exists, and the only
 * moment a balance may go up — the checkout route deliberately credits
 * nothing, because a session created is not a session paid.
 *
 * Set it up with:
 *
 *   stripe listen --forward-to localhost:3000/api/stripe/webhook
 *   STRIPE_WEBHOOK_SECRET=whsec_…      in .env
 *
 * Two things about this file are load-bearing.
 *
 * The body is read raw. Stripe signs the exact bytes it sent, and
 * `request.json()` re-serialises them — key order and whitespace both move,
 * and the signature stops matching. There is no way to verify a parsed body.
 *
 * And the signature is verified before anything is read out of the event. An
 * unverified webhook is an unauthenticated POST that hands out credits to
 * whoever guessed the URL.
 */
export const POST = async (request: Request) => {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    // 503 rather than 500: Stripe retries on both, and this one is fixed by
    // setting an environment variable rather than by deploying code.
    return new Response("Stripe webhooks are not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) return new Response("No signature", { status: 400 });

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch (cause) {
    // 400, deliberately. Stripe stops retrying a 400 and keeps retrying a 500,
    // and a body that does not match its signature will never match it.
    console.error("[stripe] rejected a webhook:", cause);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await onCheckoutCompleted(event.data.object);
    }

    // Everything else is acknowledged and ignored. Returning an error for an
    // event we do not handle makes Stripe retry it for three days and turns
    // the dashboard's delivery log red for no reason.
    return Response.json({ received: true });
  } catch (cause) {
    // A 500 asks Stripe to try again, which is what we want: the payment is
    // real and the credits are owed, and the next delivery is idempotent.
    console.error(`[stripe] ${event.type} failed:`, cause);
    return new Response("Handler failed", { status: 500 });
  }
};

/**
 * Money arrived for a pack.
 *
 * The session id is passed through as the reference, so Stripe's habit of
 * delivering the same event more than once costs nothing — Convex refuses a
 * second credit against a reference it has already seen.
 */
const onCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
  // `complete` is the only status worth acting on. An expired session can
  // arrive here too, and it means the opposite thing.
  if (session.status !== "complete" || session.payment_status === "unpaid") return;

  const userId = session.metadata?.clerkUserId;
  const credits = Number(session.metadata?.credits ?? 0);

  if (!userId || !Number.isFinite(credits) || credits <= 0) {
    // Somebody else's checkout, or one created before this metadata existed.
    // Not an error — there is nothing to do and nothing to retry.
    console.warn(`[stripe] session ${session.id} has no credits to grant`);
    return;
  }

  const { credited, balance } = await creditPack({
    userId,
    credits,
    reference: session.id,
  });

  console.log(
    credited
      ? `[stripe] credited ${credits} to ${userId}, balance ${balance}`
      : `[stripe] session ${session.id} was already credited`,
  );
};
