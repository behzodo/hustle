import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchQuery, fetchMutation } from "convex/nextjs";

import { api } from "@/../convex/_generated/api";
import { appUrl } from "@/lib/site";
import { getStripe, PLATFORM_COUNTRY, STRIPE_API_VERSION } from "@/lib/stripe";

/**
 * Starts (or resumes) Stripe Connect onboarding for the signed-in user.
 *
 * Uses the Accounts v2 API. Stripe now rejects v1 account creation outright
 * for new platforms ("Stripe no longer recommends Accounts v1"), so this
 * cannot fall back to `stripe.accounts.create`.
 *
 * Account Links are single-use and expire within minutes, so a fresh one is
 * minted on every call rather than cached.
 */
export const POST = async () => {
  const { userId, getToken } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const stripe = getStripe();

  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured on this environment" },
      { status: 503 }
    );
  }

  try {
    const token = await getToken({ template: "convex" });

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const profile = await fetchQuery(api.profiles.status, {}, { token });
    let accountId = profile?.stripeAccountId;

    if (!accountId) {
      const user = await currentUser();
      const email = user?.primaryEmailAddress?.emailAddress;

      if (!email) {
        return NextResponse.json(
          { error: "Add an email to your account before connecting Stripe" },
          { status: 400 }
        );
      }

      // These three fields are the Connect plan's decisions, spelled out:
      // the platform collects fees, the platform carries negative balances,
      // and the freelancer gets Stripe's Express dashboard.
      //
      // `recipient` is the configuration marketplaces use — it grants
      // stripe_transfers, which is what destination charges need to move
      // the freelancer's 70% across. It also requires contact_email.
      const account = await stripe.v2.core.accounts.create(
        {
          dashboard: "express",
          contact_email: email,
          identity: { country: PLATFORM_COUNTRY },
          defaults: {
            responsibilities: {
              fees_collector: "application",
              losses_collector: "application",
            },
          },
          configuration: {
            recipient: {
              capabilities: {
                stripe_balance: { stripe_transfers: { requested: true } },
              },
            },
          },
          metadata: { clerkUserId: userId },
        },
        { apiVersion: STRIPE_API_VERSION }
      );

      accountId = account.id;
      await fetchMutation(
        api.profiles.setConnections,
        { stripeAccountId: accountId },
        { token }
      );
    }

    const link = await stripe.v2.core.accountLinks.create(
      {
        account: accountId,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            configurations: ["recipient"],
            // Stripe sends them here if the link expired before they
            // finished; the page just asks for a new one.
            refresh_url: appUrl("/connections?stripe=refresh"),
            return_url: appUrl("/connections?stripe=done"),
          },
        },
      },
      { apiVersion: STRIPE_API_VERSION }
    );

    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error("Stripe Connect onboarding failed", error);

    // Stripe's own messages say exactly what is wrong. Swallowing them
    // behind a generic string means digging through logs for every failure.
    const message =
      error instanceof Error
        ? error.message
        : "Could not start Stripe onboarding";

    return NextResponse.json({ error: message }, { status: 502 });
  }
};
