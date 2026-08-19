import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { fulfil } from "@/domains/fulfil";
import { getStripe } from "@/lib/stripe";

/**
 * Where the buyer lands after paying, and where the domain is actually bought.
 *
 * Fulfilling on the return rather than on a webhook, deliberately. A webhook is
 * the more robust half of this and it is also invisible: the person is sitting
 * on a page waiting to be told whether they own a domain, and telling them
 * thirty seconds later out of a background job is a worse experience than
 * telling them now. The registrar call takes a couple of seconds.
 *
 * What makes that safe is that everything here is idempotent. `claimPaid` moves
 * the order out of `pending` in one transaction, so a refreshed page finds it
 * already claimed and does nothing; the registrar takes the order id as an
 * idempotency key, so even a request that got through twice buys one domain.
 *
 * The gap it leaves is a buyer who pays and closes the tab before this runs.
 * That order sits on `paid` with the money taken and no domain, which is the
 * state the shop's own list shows as needing attention — visible, and
 * finishable by opening it again.
 */

const back = (origin: string, path: string, params: Record<string, string>) => {
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  return Response.redirect(url.toString(), 303);
};

export async function GET(request: Request) {
  const { userId, getToken } = await auth();
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? new URL(request.url).origin;

  if (!userId) return Response.redirect(new URL("/sign-in", origin).toString(), 303);

  const token = await getToken({ template: "convex" });
  if (!token) return Response.redirect(new URL("/sign-in", origin).toString(), 303);

  const params = new URL(request.url).searchParams;
  const orderId = params.get("order") as Id<"domains"> | null;
  const sessionId = params.get("session_id");

  if (!orderId || !sessionId) return back(origin, "/hustles", { domain: "missing" });

  const order = await fetchQuery(api.domains.get, { orderId }, { token });
  if (!order) return back(origin, "/hustles", { domain: "missing" });

  const home = `/hustles/${order.projectId}`;

  // Already done, on a page that was refreshed or opened twice. Nothing to do
  // and nothing wrong.
  if (order.status === "live") {
    return back(origin, home, { domain: "live", name: order.domain });
  }

  const stripe = getStripe();
  if (!stripe) return back(origin, home, { domain: "unconfigured" });

  // The payment is proved against Stripe rather than inferred from having
  // arrived at this URL. A success_url is a link, and a link can be typed.
  const session = await stripe.checkout.sessions
    .retrieve(sessionId)
    .catch(() => null);

  if (!session || session.payment_status !== "paid") {
    return back(origin, home, { domain: "unpaid" });
  }

  if (session.client_reference_id !== orderId) {
    return back(origin, home, { domain: "mismatch" });
  }

  const claim = await fetchMutation(
    api.domains.claimPaid,
    { orderId, sessionId },
    { token },
  ).catch(() => null);

  if (!claim) return back(origin, home, { domain: "failed" });

  // Somebody else — another tab, an earlier refresh — is already buying it.
  if (!claim.claimed) {
    return back(origin, home, { domain: claim.status === "live" ? "live" : "working" });
  }

  const result = await fulfil({
    orderId,
    token,
    domain: claim.domain,
    slug: claim.slug,
    priceCents: order.priceCents,
    paymentIntent: session.payment_intent ? String(session.payment_intent) : null,
    stripe,
  });

  if (result.ok) {
    return back(origin, home, { domain: "live", name: result.domain ?? claim.domain });
  }

  return back(origin, home, {
    domain: result.refunded ? "refunded" : "failed",
    why: (result.error ?? "").slice(0, 120),
  });
}
