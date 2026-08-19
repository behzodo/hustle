import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";

import { appUrl } from "@/lib/site";
import { packBySlug } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";

/**
 * Buys a credit pack.
 *
 * A plain Stripe Checkout session on the platform account — not Connect. The
 * money is ours, for our own product, and has nothing to do with the
 * destination charges in src/pay/invoice.ts that move a freelancer's share of
 * a client invoice. Two different flows on the same Stripe account, and
 * confusing them is how a platform ends up transferring its own revenue away.
 *
 * Nothing is credited here. The session only takes the payment; the balance
 * moves in the webhook, on `checkout.session.completed`, because that is the
 * only event that means money actually arrived. A user who closes the tab on
 * the Stripe page has still hit this route.
 */
export const POST = async (request: Request) => {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const stripe = getStripe();

  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured on this environment" },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));

  // The slug is the only thing taken from the client. The price and the credit
  // count are looked up here — a request that could name its own amount is a
  // request that could buy three thousand credits for a dollar.
  const pack = packBySlug(String(body?.pack ?? ""));

  if (!pack) {
    return NextResponse.json({ error: "No such pack" }, { status: 400 });
  }

  try {
    const user = await currentUser();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Prefills the Stripe page and gives the receipt somewhere to go. Absent
      // is survivable — Stripe asks for one — so this is not gated on it.
      customer_email: user?.primaryEmailAddress?.emailAddress,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.price,
            product_data: {
              name: `Hustle — ${pack.name}`,
              description:
                "Credits for sweeps, sites and pitches. They do not expire.",
            },
          },
        },
      ],
      // Everything the webhook needs to credit the right account, carried on
      // the session rather than looked up. The webhook has no user session of
      // its own, and matching a Stripe customer back to a Clerk id afterwards
      // is a lookup that can fail; this cannot.
      metadata: {
        clerkUserId: userId,
        pack: pack.slug,
        credits: String(pack.credits),
      },
      success_url: appUrl("/pricing?bought=1"),
      cancel_url: appUrl("/pricing"),
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout page" },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[credits] checkout failed", error);

    const message =
      error instanceof Error ? error.message : "Could not start checkout";

    return NextResponse.json({ error: message }, { status: 502 });
  }
};
