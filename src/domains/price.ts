/**
 * What the domain costs us, and what it sells for.
 *
 * The only place those two numbers are allowed to meet. Everything upstream
 * talks about a wholesale figure from the registrar and everything downstream
 * talks about a retail one on a card, and keeping the arithmetic in one file is
 * what stops a screen ever showing the wrong one of the pair.
 *
 * No `server-only` here on purpose: the card renders the retail price and the
 * checkout charges it, and both should be reading the same function.
 */

/** The markup, in basis points. 4000 = 40% on top of what we paid. */
const DEFAULT_MARKUP_BPS = 4_000;

/**
 * The least we will make on one, in cents.
 *
 * A percentage alone is not enough at the bottom of the range: forty percent
 * of a six-dollar first-year promo is two dollars and forty cents, against a
 * card fee of roughly thirty cents plus the renewal we are on the hook for
 * next year. Cheap first years are the norm rather than the exception, so the
 * floor is what actually sets the price on most sales.
 */
const MIN_MARGIN_CENTS = 500;

const markupBps = () => {
  const raw = Number(process.env.DOMAIN_MARKUP_BPS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_MARKUP_BPS;
};

export interface Quoted {
  /** What the registrar charges us. Never shown to the buyer. */
  costCents: number;
  /** What the buyer pays. */
  priceCents: number;
  /** What we keep. */
  marginCents: number;
}

/**
 * The retail price for a domain that costs `costCents` wholesale.
 *
 * Rounded up to a whole dollar. A price of $17.24 on a button reads as a
 * number somebody calculated at you; $18 reads as a price.
 */
export const quote = (costCents: number): Quoted => {
  const withMarkup = costCents + Math.round((costCents * markupBps()) / 10_000);
  const floor = costCents + MIN_MARGIN_CENTS;

  const priceCents = Math.ceil(Math.max(withMarkup, floor) / 100) * 100;

  return { costCents, priceCents, marginCents: priceCents - costCents };
};

/** Money, the way it goes on a button. */
export const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    // Whole dollars, because `quote` only ever produces them.
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
