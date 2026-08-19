import "server-only";

import { slugify } from "@/publish/slug";

import * as cf from "./cloudflare";
import * as map from "./map";
import * as porkbun from "./porkbun";
import { money, quote, type Quoted } from "./price";

export { money, quote } from "./price";
export { PorkbunError } from "./porkbun";
export type { Quoted } from "./price";

/**
 * The domain shop.
 *
 * Four moving parts, in the order they have to happen: the registrar sells the
 * name, the registrar's DNS points it here, Cloudflare issues it a
 * certificate, and the bucket learns which site it shows. Every one of them
 * can fail and only the first one costs money, which is what decides the
 * order — nothing irreversible happens until everything reversible has already
 * worked.
 *
 * The user sees none of this. They pick a name on a lead's card, pay once, and
 * a minute later the site the app built is answering on a domain with their
 * client's name on it and nothing of ours anywhere in the address.
 */

/** How many TLDs a search offers. More than this is a list nobody reads. */
const TLDS = [".com", ".co", ".net", ".org", ".shop"] as const;

export const configured = () => porkbun.configured() && cf.configured();

export interface Offer {
  domain: string;
  available: boolean;
  /** What the buyer pays, in cents. Absent when it cannot be bought. */
  priceCents?: number;
  /** The same, written out. */
  price?: string;
  why?: string;
}

/**
 * A business name, as the front of a domain.
 *
 * Hyphens come out, unlike a slug. `joes-gym.korvians.online` is a subdomain
 * and reads fine; `joes-gym.com` is a domain somebody has to say down a phone,
 * and every hyphen in one is a word the listener has to be told about.
 */
export const domainRoot = (name: string) => slugify(name).replace(/-/g, "").slice(0, 40);

/**
 * What this business could be called, with prices.
 *
 * Checked in parallel because it is five independent reads and a user watching
 * a search box will not wait five times for one answer. A TLD that errors is
 * dropped rather than failing the search — one registry being slow should cost
 * a row, not the screen.
 */
export const search = async (name: string): Promise<Offer[]> => {
  const root = name.includes(".") ? name.trim().toLowerCase() : domainRoot(name);

  if (!root) return [];

  // A whole domain was typed. Answer that one and nothing else — somebody who
  // types "joesgym.net" is asking about .net, not asking to be sold .com.
  const wanted = root.includes(".") ? [root] : TLDS.map((tld) => `${root}${tld}`);

  const offers = await Promise.all(
    wanted.map(async (domain): Promise<Offer> => {
      try {
        const found = await porkbun.check(domain);

        if (!found.available) {
          return { domain, available: false, why: found.why ?? "Already taken" };
        }

        const priced = quote(found.costCents);

        return {
          domain,
          available: true,
          priceCents: priced.priceCents,
          price: money(priced.priceCents),
        };
      } catch (cause) {
        return {
          domain,
          available: false,
          why: cause instanceof Error ? cause.message : "Could not check that one",
        };
      }
    }),
  );

  return offers;
};

/**
 * The wholesale figure behind a retail one, re-fetched at purchase time.
 *
 * Never trusted from the browser. The price on the button came from a search
 * that may be ten minutes old, and the number that decides what we charge has
 * to be the one the registrar is quoting now — otherwise a price that moved
 * upward is a sale we lose money on, and one that moved downward is a customer
 * who overpaid.
 */
export const priceNow = async (domain: string): Promise<Quoted> => {
  const found = await porkbun.check(domain);

  if (!found.available) {
    throw new Error(found.why ?? "That domain is no longer available.");
  }

  return quote(found.costCents);
};

export interface Bought {
  domain: string;
  /** What the registrar charged us, in cents. */
  costCents: number;
  /** The Cloudflare custom hostname, for polling the certificate. */
  hostnameId: string;
  /** Where the certificate has got to at the moment of return. */
  sslStatus?: string;
}

/**
 * Buys the domain and wires it to a site.
 *
 * `orderId` is the idempotency key the registrar sees, so calling this twice
 * for the same order buys one domain. That matters more than it sounds: this
 * runs after a payment, and the natural response to a payment whose
 * fulfilment timed out is to run it again.
 *
 * The two steps after the purchase are wrapped rather than left to throw.
 * Once the registrar has taken the money the domain exists and belongs to the
 * buyer, and a failed DNS write is a thing to retry — not a reason to report
 * a purchase that did happen as one that did not.
 */
export const buy = async ({
  domain,
  slug,
  orderId,
  maxCostCents,
}: {
  domain: string;
  /** The site the domain should show. */
  slug: string;
  /** Stable across retries of the same purchase. */
  orderId: string;
  /**
   * Refuse to spend more than this, in cents. What the buyer actually paid —
   * so the worst case is a sale with no margin rather than one that costs us
   * money, however far the wholesale price has moved since the quote.
   */
  maxCostCents: number;
}): Promise<Bought> => {
  const priced = await priceNow(domain);

  // The registrar now wants more than the buyer paid. The caller refunds;
  // nothing has been spent.
  if (priced.costCents > maxCostCents) {
    throw new Error(
      `The price of ${domain} changed while you were paying. Nothing was charged.`,
    );
  }

  const registered = await porkbun.register({
    domain,
    costCents: priced.costCents,
    idempotencyKey: orderId,
  });

  // From here the domain is bought. Everything below is recoverable.
  const target = cf.fallbackOrigin();

  await porkbun.pointAt(domain, target).catch((cause) => {
    console.error(`[domains] bought ${domain} but could not set DNS:`, cause);
  });

  await map.point(domain, slug).catch((cause) => {
    console.error(`[domains] bought ${domain} but could not map it to ${slug}:`, cause);
  });

  let hostname: cf.CustomHostname | null = null;

  try {
    hostname = await cf.attach(domain);
  } catch (cause) {
    console.error(`[domains] bought ${domain} but could not attach it to the zone:`, cause);
  }

  return {
    domain,
    costCents: registered.costCents,
    hostnameId: hostname?.id ?? "",
    sslStatus: hostname?.sslStatus,
  };
};

/** Where a domain's certificate has got to. The card polls this. */
export const certificateStatus = async (hostnameId: string) => {
  if (!hostnameId) return null;
  return await cf.status(hostnameId);
};

/** Re-points an existing domain at a different site. */
export const repoint = (domain: string, slug: string) => map.point(domain, slug);
