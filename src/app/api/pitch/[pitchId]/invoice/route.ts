import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { recordPitchInvoice } from "@/inngest/convex";
import { emailInvoice, money, priceFor, raiseInvoice } from "@/pay/invoice";

/**
 * Raising the invoice by hand.
 *
 * The automatic path in src/pay/close.ts covers the case where a business
 * plainly agreed. This is for the other half of real life: the deal that was
 * closed on the phone, the one where the price is not the band's, and the one
 * where the classifier read "yeah go on then" as merely keen.
 *
 * Same call underneath, same idempotency guard, and the amount comes from the
 * screen rather than the profile — because the person pressing this knows what
 * they agreed and the price band is only ever a starting figure.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ pitchId: string }> },
) {
  const { pitchId } = await params;
  const { userId, getToken } = await auth();

  if (!userId) return new Response("Unauthorized", { status: 401 });

  const token = await getToken({ template: "convex" });
  if (!token) return new Response("Unauthorized", { status: 401 });

  const pitch = await fetchQuery(
    api.pitches.forInvoice,
    { pitchId: pitchId as Id<"pitches"> },
    { token },
  );

  if (!pitch) return new Response("Not found", { status: 404 });

  if (pitch.invoiced) {
    return Response.json({ error: "That one already has an invoice." }, { status: 409 });
  }

  if (!pitch.stripeAccountId) {
    return Response.json(
      { error: "Connect Stripe first — there is nowhere for the money to go." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  // Whole units on the wire, cents underneath. A screen that asks for 900 and
  // a field that means 90,000 is how somebody bills a client nine dollars.
  const dollars = Number(body?.amount);
  const amount =
    Number.isFinite(dollars) && dollars > 0
      ? Math.round(dollars * 100)
      : priceFor(pitch.priceBand);

  try {
    const invoice = await raiseInvoice({
      accountId: pitch.stripeAccountId,
      business: pitch.business,
      siteUrl: pitch.siteUrl,
      amount,
      email: pitch.channel === "email" ? pitch.to : undefined,
      phone: pitch.channel === "sms" ? pitch.to : undefined,
      tradingName: pitch.tradingName,
    });

    const { recorded } = await recordPitchInvoice({
      pitchId,
      invoice: {
        id: invoice.id,
        url: invoice.url,
        number: invoice.number,
        amount: invoice.amount,
        currency: invoice.currency,
        fee: invoice.fee,
      },
    });

    if (!recorded) {
      return Response.json({ error: "That one already has an invoice." }, { status: 409 });
    }

    // Stripe emails it where there is an address. A business reached by text
    // gets the link from the screen, because Stripe cannot email a phone.
    if (pitch.channel === "email") await emailInvoice(invoice.id).catch(() => {});

    return Response.json({
      url: invoice.url,
      amount: invoice.amount,
      shown: money(invoice.amount, invoice.currency),
      emailed: pitch.channel === "email",
    });
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Stripe refused it" },
      { status: 502 },
    );
  }
}
