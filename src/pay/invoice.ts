import "server-only";

import { getStripe, platformFeeFor } from "@/lib/stripe";

/**
 * Raising the invoice when a business says yes.
 *
 * The last step of the whole product, and the only one that moves money. A
 * sweep finds a shop with no website, the fast lane builds them one, the pitch
 * lane sends it, they answer — and this is what turns that into a number in
 * somebody's bank account.
 *
 * The charge is a destination charge on the platform, not a direct charge on
 * the freelancer's account, because that is what this Connect configuration
 * supports: `recipient` accounts hold a Stripe balance and receive transfers,
 * they do not process card payments of their own. So the customer pays us, the
 * invoice carries `transfer_data.destination` to move their share across, and
 * `application_fee_amount` keeps ours. One API call, both movements, and no
 * window in which the money is ours and should not be.
 *
 * The freelancer is the merchant of record on paper and the platform is in
 * practice — which also means refunds and chargebacks land on the platform
 * balance. Worth knowing before the first dispute rather than during it.
 */

/** Everything is billed in dollars: the price bands are written in dollars. */
const CURRENCY = "usd";

/** A week. Long enough not to feel like a demand, short enough to be a deadline. */
const DAYS_UNTIL_DUE = 7;

/**
 * What to charge, by the band on the profile, in cents.
 *
 * A band is a range and an invoice is a number, so each one resolves to a
 * point inside it rather than to its floor: quoting the bottom of your own
 * range on every job is a way of never earning the top of it. Every one of
 * these is overridable per deal — the screen offers the figure, the person
 * sending it decides.
 */
const BAND_CENTS: Record<string, number> = {
  under_500: 40_000,
  "500_1500": 90_000,
  "1500_5000": 250_000,
  over_5000: 600_000,
};

export const priceFor = (band: string | undefined) => BAND_CENTS[band ?? ""] ?? 90_000;

export interface RaiseInvoice {
  /** The freelancer's connected account. Where the money ends up. */
  accountId: string;
  business: string;
  siteUrl: string;
  /** Amount in cents. Defaults to the profile's band. */
  amount: number;
  /** Theirs, when the conversation happened by email. */
  email?: string;
  phone?: string;
  /** Signs the line item, so the invoice reads as theirs and not as ours. */
  tradingName: string;
}

export interface RaisedInvoice {
  id: string;
  /** The page the business pays on. Works in a text as well as an email. */
  url: string;
  number?: string;
  amount: number;
  currency: string;
  /** What the platform keeps, in cents. Stored so it is never recomputed. */
  fee: number;
}

/**
 * Creates it, finalises it, and hands back the link.
 *
 * Finalised rather than left as a draft: a draft invoice has no payable URL,
 * and the entire value of doing this automatically is that the link exists in
 * the same message that says yes. A draft would mean a second step by a person
 * an hour later, which is the thing being removed.
 */
export const raiseInvoice = async ({
  accountId,
  business,
  siteUrl,
  amount,
  email,
  phone,
  tradingName,
}: RaiseInvoice): Promise<RaisedInvoice> => {
  const stripe = getStripe();

  if (!stripe) throw new Error("Stripe is not configured on this environment.");
  if (amount < 100) throw new Error("That is below Stripe's minimum charge.");

  // On the platform, not the connected account. The customer is ours because
  // the charge is ours; the freelancer's share moves by transfer.
  const customer = await stripe.customers.create({
    name: business,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    metadata: { business, siteUrl, forAccount: accountId },
  });

  const invoice = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: DAYS_UNTIL_DUE,
    currency: CURRENCY,
    // The freelancer's share, moved the moment it is paid.
    transfer_data: { destination: accountId },
    application_fee_amount: platformFeeFor(amount),
    description: `Website for ${business} — ${siteUrl.replace(/^https?:\/\//, "")}`,
    metadata: { business, siteUrl, forAccount: accountId },
    // Off, deliberately. Tax on a one-off website build varies by state and by
    // whether the freelancer is registered, and getting it wrong on somebody
    // else's invoice is worse than leaving it to them.
    automatic_tax: { enabled: false },
  });

  await stripe.invoiceItems.create({
    customer: customer.id,
    invoice: invoice.id,
    currency: CURRENCY,
    amount,
    description: `Website design and build by ${tradingName}`,
  });

  // Re-fetched rather than trusted: the totals on the object above were
  // calculated before the line item existed.
  const finalised = await stripe.invoices.finalizeInvoice(invoice.id!);

  if (!finalised.hosted_invoice_url) {
    throw new Error("Stripe finalised the invoice without a payment page.");
  }

  return {
    id: finalised.id!,
    url: finalised.hosted_invoice_url,
    number: finalised.number ?? undefined,
    amount: finalised.amount_due,
    currency: finalised.currency,
    fee: platformFeeFor(amount),
  };
};

/**
 * Asks Stripe to email it as well.
 *
 * Only where there is an address. A business reached by text gets the link in
 * a text — Stripe cannot send an invoice to a phone number, and an invoice
 * that exists but was never delivered is the worst of both.
 */
export const emailInvoice = async (invoiceId: string): Promise<void> => {
  const stripe = getStripe();
  if (!stripe) return;

  await stripe.invoices.sendInvoice(invoiceId);
};

/** Money, the way it is written on a screen. */
export const money = (cents: number, currency = CURRENCY) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
