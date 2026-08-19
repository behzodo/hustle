import "server-only";

import { recordPitchInvoice } from "@/inngest/convex";
import { emailInvoice, money, priceFor, raiseInvoice } from "@/pay/invoice";
import type { Verdict } from "@/pitch/read-reply";

/**
 * Closing the deal, the moment it is a deal.
 *
 * The last link in the chain the diagram draws: a business says yes, and an
 * invoice they can pay is in front of them before they have put the phone
 * down. Not in an hour, not tomorrow — a local business owner who agrees to
 * something and then waits is a local business owner who reconsiders.
 *
 * Only on `deal`. `keen` is somebody asking the price, and an invoice sent in
 * answer to a question is how a job that was about to happen stops happening.
 * That distinction is the entire reason the classifier has five verdicts
 * instead of four; see src/pitch/read-reply.ts.
 *
 * Idempotent by way of Convex rather than by way of care: `recordPitchInvoice`
 * refuses a pitch that already has one and says so, and this only sends the
 * link when it was the call that created it. Two replies arriving a second
 * apart is not a hypothetical — it is what happens when somebody texts "yes"
 * and then "sorry, yes please".
 */

export interface Closing {
  pitchId: string;
  verdict: Verdict;
  business: string;
  siteUrl: string;
  /** The address the conversation happened at. */
  to: string;
  invoiced: boolean;
  sender: {
    tradingName: string;
    priceBand?: string;
    stripeAccountId?: string;
  };
  /** Overrides the band's figure, in cents. Set when a person typed one. */
  amount?: number;
}

export interface Closed {
  url: string;
  amount: number;
  /** A line to append to the reply, or send on its own. */
  line: string;
}

export const closeIfAgreed = async (closing: Closing): Promise<Closed | null> => {
  if (closing.verdict !== "deal") return null;
  if (closing.invoiced) return null;

  // No Stripe, no invoice. Left silent rather than raised as an error: the
  // reply still goes out, the deal is still a deal, and the screen shows the
  // conversation with a Connect prompt on it.
  if (!closing.sender.stripeAccountId) return null;

  const amount = closing.amount ?? priceFor(closing.sender.priceBand);

  const invoice = await raiseInvoice({
    accountId: closing.sender.stripeAccountId,
    business: closing.business,
    siteUrl: closing.siteUrl,
    amount,
    email: closing.to,
    tradingName: closing.sender.tradingName,
  });

  const { recorded } = await recordPitchInvoice({
    pitchId: closing.pitchId,
    invoice: {
      id: invoice.id,
      url: invoice.url,
      number: invoice.number,
      amount: invoice.amount,
      currency: invoice.currency,
      fee: invoice.fee,
    },
  });

  // Somebody else got there first. The invoice above is a duplicate and must
  // not be sent — an unsent finalised invoice is a tidy-up job, a second one
  // in a client's inbox is a phone call.
  if (!recorded) return null;

  // Stripe delivers it. The line below only tells them it is coming, so the
  // reply and the invoice are not two separate surprises.
  await emailInvoice(invoice.id).catch(() => {});

  const shown = money(invoice.amount, invoice.currency);

  return {
    url: invoice.url,
    amount: invoice.amount,
    line: `The invoice for ${shown} is on its way to ${closing.to}.`,
  };
};
