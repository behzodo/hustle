/**
 * Google Maps, read through Scrape.do.
 *
 * The fallback. It works and it is well documented, but it bills ten credits
 * per page against Serper's one or two, and it drives a proxy at Google for
 * every request rather than answering from an index — so the same sweep costs
 * several times as much and takes several times as long.
 *
 * Kept because a provider that is merely expensive is still worth having when
 * the cheap one is rate limited or down, and because switching back is then a
 * matter of which key is set rather than a deploy.
 *
 * Set the token on the Convex deployment, not in .env — this runs inside
 * Convex's runtime:
 *   npx convex env set SCRAPE_DO_TOKEN "<token>"
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

const ENDPOINT = "https://api.scrape.do/plugin/google/maps/search";

/** Requests that took longer than this are a dead proxy, not a slow page. */
const TIMEOUT_MS = 45_000;

/** One retry only. A second failure is a real outage, not a blip. */
const RETRIES = 1;

/** Results per Maps page, and what the `start` offset steps by. */
export const PAGE_SIZE = 20;

export const configured = () => Boolean(process.env.SCRAPE_DO_TOKEN);

const token = () => {
  const value = process.env.SCRAPE_DO_TOKEN;

  if (!value) {
    throw new PlacesError(
      'Discovery is not configured. Run: npx convex env set SCRAPE_DO_TOKEN "<token>"',
      0,
      false,
    );
  }

  return value;
};

/**
 * Pull one listing out of whatever shape the row arrived in.
 *
 * Scrape.do documents `gps_coordinates: { latitude, longitude }` for the Maps
 * endpoints but also publishes examples using `coordinates: { lat, lng }`, and
 * a scraper's output tracks whatever Google last rendered. Reading both costs
 * nothing; guessing wrong costs a whole sweep of leads pinned at 0,0.
 */
const readPlace = (row: Record<string, unknown>): MapsPlace | null => {
  const placeId = str(row.place_id) ?? str(row.data_id) ?? str(row.data_cid);
  const name = str(row.title) ?? str(row.name);
  if (!placeId || !name) return null;

  const coords = (row.gps_coordinates ?? row.coordinates ?? {}) as Record<string, unknown>;
  const lat = num(coords.latitude) ?? num(coords.lat);
  const lng = num(coords.longitude) ?? num(coords.lng) ?? num(coords.lon);
  if (lat === undefined || lng === undefined) return null;

  return {
    placeId,
    name,
    lat,
    lng,
    address: str(row.address) ?? str(row.formatted_address),
    phone: phone(row.phone) ?? phone(row.phone_number),
    website: str(row.website),
    rating: num(row.rating),
    reviewCount: num(row.reviews) ?? num(row.review_count) ?? num(row.user_ratings_total),
    // `types` is the array form of `type` and carries the secondary categories
    // a listing can have; `type` alone is only ever the first one.
    categories: categories(row.types, row.type),
    // Same picture Serper returns, under whichever key this rendering used.
    photo: str(row.thumbnail) ?? str(row.thumbnail_url) ?? str(row.image),
  };
};

/** One page of one Maps search. Billed per call, at ten credits each. */
export const search = async (
  { q, lat, lng, zoom, page = 0, gl = "us" }: SearchArgs,
  attempt = 0,
): Promise<MapsPlace[]> => {
  const url = new URL(ENDPOINT);
  url.searchParams.set("token", token());
  url.searchParams.set("q", q);
  url.searchParams.set("ll", `@${lat.toFixed(6)},${lng.toFixed(6)},${zoom}z`);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", gl);
  if (page > 0) url.searchParams.set("start", String(page * PAGE_SIZE));

  let response: Response;

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (cause) {
    if (attempt < RETRIES) return search({ q, lat, lng, zoom, page, gl }, attempt + 1);
    throw new PlacesError(`Maps search failed to connect: ${String(cause)}`, 0, true);
  }

  if (!response.ok) {
    // 429 is the account's concurrency cap, 5xx is their side. Both pass on a
    // second try; 401 and 400 are our mistake, or a spent quota, and never will.
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

  const root = (body ?? {}) as Record<string, unknown>;
  const rows = root.local_results ?? root.results ?? root.places;
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null)
    .map(readPlace)
    .filter((place): place is MapsPlace => place !== null);
};
