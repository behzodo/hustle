/**
 * Google Maps, read through Serper.
 *
 * The default provider, and the reason is arithmetic. Scrape.do bills ten
 * credits for one page of one search; Serper bills one, two if the page holds
 * more than ten results. A sweep of a city is dozens of searches, so the same
 * patch is roughly five times cheaper here — and it comes back in a second or
 * two rather than several, because Serper answers from its own index instead
 * of driving a proxy at Google per request.
 *
 * It also hands back exactly the shape this engine wants: a flat `places`
 * array with `website`, `latitude`, `longitude`, `ratingCount` and `types`
 * already separated out, so nothing here has to guess at a rendering.
 *
 * Set the key on the Convex deployment, not in .env — this runs inside
 * Convex's runtime:
 *   npx convex env set SERPER_API_KEY "<key>"
 */

import {
  PlacesError,
  categories,
  num,
  phone,
  str,
  type MapsPlace,
  type SearchArgs,
} from "./types";

const ENDPOINT = "https://google.serper.dev/maps";

/** Answers land in 1–2s, so anything past this is a hung connection. */
const TIMEOUT_MS = 20_000;

/** One retry only. A second failure is a real outage, not a blip. */
const RETRIES = 1;

/** Results Serper returns per page, and what `page` steps by. */
export const PAGE_SIZE = 20;

export const configured = () => Boolean(process.env.SERPER_API_KEY);

const key = () => {
  const value = process.env.SERPER_API_KEY;

  if (!value) {
    throw new PlacesError(
      'Discovery is not configured. Run: npx convex env set SERPER_API_KEY "<key>"',
      0,
      false,
    );
  }

  return value;
};

const readPlace = (row: Record<string, unknown>): MapsPlace | null => {
  // `cid` is Google's other id for the same listing and is present on rows
  // that lack a placeId, so between them nothing usable is dropped.
  const placeId = str(row.placeId) ?? str(row.cid);
  const name = str(row.title);
  const lat = num(row.latitude);
  const lng = num(row.longitude);

  if (!placeId || !name || lat === undefined || lng === undefined) return null;

  return {
    placeId,
    name,
    lat,
    lng,
    address: str(row.address),
    phone: phone(row.phoneNumber),
    website: str(row.website),
    rating: num(row.rating),
    reviewCount: num(row.ratingCount),
    categories: categories(row.types, row.type),
    photo: str(row.thumbnailUrl),
  };
};

/**
 * One page of one Maps search. Billed per call.
 *
 * Throws rather than returning an empty page on failure: a hunt that quietly
 * swallowed a dead key would report "0 businesses found" and read as an empty
 * town rather than a broken setup.
 */
export const search = async (
  { q, lat, lng, zoom, page = 0, gl = "us" }: SearchArgs,
  attempt = 0,
): Promise<MapsPlace[]> => {
  let response: Response;

  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "X-API-KEY": key(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q,
        // Same pinning format Google's own URLs use: a point and a zoom.
        ll: `@${lat.toFixed(6)},${lng.toFixed(6)},${zoom}z`,
        gl,
        hl: "en",
        // Serper counts pages from one.
        page: page + 1,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    if (attempt < RETRIES) return search({ q, lat, lng, zoom, page, gl }, attempt + 1);
    throw new PlacesError(`Maps search failed to connect: ${String(cause)}`, 0, true);
  }

  if (!response.ok) {
    // 429 is the account's rate limit and 5xx is their side; both pass on a
    // second try. 401 and 403 are a bad or spent key and never will.
    const retryable = response.status === 429 || response.status >= 500;

    if (retryable && attempt < RETRIES) {
      return search({ q, lat, lng, zoom, page, gl }, attempt + 1);
    }

    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new PlacesError(
      `Maps search returned ${response.status}${detail ? `: ${detail}` : ""}`,
      response.status,
      retryable,
    );
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch (cause) {
    throw new PlacesError(`Maps search returned unreadable JSON: ${String(cause)}`, 200, false);
  }

  const rows = (body as { places?: unknown })?.places;
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map(readPlace)
    .filter((place): place is MapsPlace => place !== null);
};
