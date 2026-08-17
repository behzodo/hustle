/**
 * What the discovery engine needs back from a maps provider, and nothing else.
 *
 * There is no single API for "every business near here, and whether it has a
 * website" — Google's own Places API meters that field into a higher billing
 * tier, and every scraper that answers it has a different shape and a
 * different way of running out. So the engine talks to this instead, and the
 * provider behind it is a config value rather than a rewrite.
 */

/** A business as Maps listed it, with the fields normalised. */
export interface MapsPlace {
  /** Google's stable id for the listing. The dedupe key across tiles. */
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  /** Human-readable categories, e.g. ["Hair salon", "Barber shop"]. */
  categories: string[];
  /**
   * Whether a missing `website` actually means the business has none.
   *
   * True for anything read off a Google listing: the field is there, and an
   * empty one is the owner saying they have no site. False for OpenStreetMap,
   * where the tag is only present if a volunteer typed it in — so an absent
   * website is unknown, not absent. Defaults to true when a provider does not
   * say, because every paid provider reads Google.
   */
  websiteKnown?: boolean;
}

export interface SearchArgs {
  /** The phrase, e.g. "hair salon". */
  q: string;
  lat: number;
  lng: number;
  zoom: number;
  /** Zero-based. Each provider maps it onto its own pagination. */
  page?: number;
  /** Country perspective. The wizard only allows US and Canada. */
  gl?: string;
}

export class PlacesError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** False for a bad key or a malformed query — retrying cannot help. */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PlacesError";
  }
}

// --- Shared parsing ---------------------------------------------------------

export const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
      ? Number(value)
      : undefined;

export const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

/**
 * A phone number, or nothing.
 *
 * Providers reading Google's rendered listing sometimes put the street address
 * in the phone slot when the listing has no number — Serper's own published
 * example does exactly that. A lead card showing "3950 24th St" under a phone
 * icon is worse than showing no number, and the score counts a number as
 * reachability it would not actually have.
 */
export const phone = (value: unknown): string | undefined => {
  const text = str(value);
  if (text === undefined) return undefined;

  const digits = text.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? text : undefined;
};

/** Categories from whichever of the two shapes a provider returns. */
export const categories = (list: unknown, single: unknown): string[] => {
  if (Array.isArray(list)) {
    return list
      .filter((entry): entry is string => typeof entry === "string")
      .slice(0, 4);
  }

  const one = str(single);
  return one === undefined ? [] : [one];
};
