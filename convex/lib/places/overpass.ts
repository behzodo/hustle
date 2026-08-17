/**
 * Businesses from OpenStreetMap, via Overpass.
 *
 * The bottom of the waterfall, and the only tier that cannot run out. No key,
 * no account, no quota, no bill — one HTTP call returns every mapped business
 * in a bounding box. When every paid provider is spent or down, this is the
 * difference between a user seeing their patch and seeing an error.
 *
 * It answers a different question, and the engine has to be told so. Google
 * knows whether a business has a website because the owner told it; OSM knows
 * only whether a volunteer typed one in. A missing `website` tag here means
 * "nobody recorded one", not "there isn't one" — of 387 named businesses in
 * central Miami, 200 carry a website tag and the rest are simply unrecorded.
 * So these come back flagged `websiteKnown: false`, and the classifier turns
 * that into "not listed" rather than the "no website" that would send someone
 * off to pitch a business that already has one.
 *
 * There are no ratings or review counts in OSM at all, so leads from here
 * score lower than the same business found through Google. That is correct:
 * we know less about them.
 */

import {
  PlacesError,
  num,
  phone,
  str,
  type MapsPlace,
  type SearchArgs,
} from "./types";

/**
 * Public instances, in order.
 *
 * All four run the same software over the same data. They are listed because
 * the free tier's real constraint is not the data, it is the throttle: each
 * instance gives an IP a couple of slots and answers `429` the moment it is
 * asked for a third. One endpoint is not a fallback, it is a single point of
 * failure with no bill attached.
 */
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

/** It reads a whole bounding box in one pass, so it is slow by design. */
const TIMEOUT_MS = 75_000;

/** Elements per query. Well past what a tile holds, and a guard on the rest. */
const MAX_ELEMENTS = 400;

/**
 * Anything that trades.
 *
 * Deliberately not per-trade. Overpass selects on tags rather than free text,
 * so a "barber shop" query is possible — but see the note on the tile cache
 * below for why one broad read of the box beats nine narrow ones.
 */
const ANY_BUSINESS = [
  'nwr["shop"]',
  'nwr["craft"]',
  'nwr["office"]',
  'nwr["healthcare"]',
  'nwr["amenity"~"^(restaurant|cafe|bar|pub|fast_food|pharmacy|dentist|doctors|veterinary|driving_school|childcare)$"]',
  'nwr["leisure"~"^(fitness_centre|sports_centre)$"]',
];

/** Always available: nothing to configure. */
export const configured = () => true;

/**
 * The half-width the planner meant by this zoom, in metres.
 *
 * Overpass takes a box, not a point and a zoom, and the plan is expressed in
 * the latter. This inverts exactly the expression in
 * src/modules/hustles/discovery/plan.ts, so the box covers the same ground the
 * Google-shaped providers were asked for.
 */
const reachFor = (lat: number, zoom: number) =>
  (156_543.03392 * Math.cos((lat * Math.PI) / 180) * 500) / 2 ** zoom;

const boxFor = (lat: number, lng: number, zoom: number) => {
  const reach = reachFor(lat, zoom);
  const dLat = (reach / 111_320) * 1.0;
  const dLng = reach / (111_320 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));

  return [
    (lat - dLat).toFixed(5),
    (lng - dLng).toFixed(5),
    (lat + dLat).toFixed(5),
    (lng + dLng).toFixed(5),
  ].join(",");
};

const queryFor = (selectors: string[], box: string) => {
  const body = selectors.map((selector) => `  ${selector}(${box});`).join("\n");

  // `out center` gives ways and relations a single point, so a shop mapped as
  // a building footprint still lands as one pin rather than a list of nodes.
  return `[out:json][timeout:60];\n(\n${body}\n);\nout center tags ${MAX_ELEMENTS};`;
};

interface Element {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

const KIND_KEYS = ["shop", "craft", "office", "healthcare", "amenity", "leisure"] as const;

const readElement = (element: Element): MapsPlace | null => {
  const tags = element.tags ?? {};
  const name = str(tags.name);
  // Unnamed features are junctions, benches and building outlines, not
  // businesses anyone can be pitched.
  if (!name || !element.type || element.id === undefined) return null;

  const lat = num(element.lat) ?? num(element.center?.lat);
  const lng = num(element.lon) ?? num(element.center?.lon);
  if (lat === undefined || lng === undefined) return null;

  const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]]
    .filter(Boolean)
    .join(" ")
    .trim();

  const kind = KIND_KEYS.map((key) => tags[key]).find(Boolean);

  return {
    // Namespaced so an OSM id can never collide with a Google place id in the
    // same project's lead list.
    placeId: `osm:${element.type}/${element.id}`,
    name,
    lat,
    lng,
    address: address === "" ? undefined : address,
    phone: phone(tags.phone) ?? phone(tags["contact:phone"]),
    website: str(tags.website) ?? str(tags["contact:website"]),
    // OSM holds no ratings or review counts at all.
    categories: kind ? [kind.replace(/_/g, " ")] : [],
    // The whole reason this provider is a tier of its own — see the note at
    // the top of the file.
    websiteKnown: false,
  };
};

/**
 * Tiles already read, so a sweep asks each one for its businesses once.
 *
 * The other providers answer a phrase, so the planner asks them once per trade
 * per tile. Overpass answers a box: one call returns every business in the
 * tile whatever the trade was, and asking again for "barber shop" would fetch
 * the same bytes and spend one of the two slots the free instances allow an IP.
 *
 * So the term is ignored here and the tile is cached instead. A forty-five
 * search plan over nine tiles becomes nine calls rather than forty-five, which
 * is the difference between this tier working and this tier being throttled
 * off on its second search. Reading every trade at once also makes the result
 * more complete, not less: the box comes back with the businesses the user's
 * trades missed as well as the ones they asked for.
 *
 * Module scope: an isolate handles one sweep and then some, and stale map data
 * inside that window is not a risk worth a cache key for.
 */
const tiles = new Map<string, MapsPlace[]>();

/** A guard on the isolate's memory, not a policy. */
const TILE_CACHE_MAX = 64;

/**
 * Every mapped business in the tile.
 *
 * Only page zero does anything: Overpass has no pagination because it returns
 * the whole box at once. Later pages come back empty rather than repeating the
 * same results under a different name.
 */
export const search = async ({
  lat,
  lng,
  zoom,
  page = 0,
}: SearchArgs): Promise<MapsPlace[]> => {
  if (page > 0) return [];

  const key = `${lat.toFixed(4)},${lng.toFixed(4)},${zoom}`;
  const cached = tiles.get(key);
  if (cached !== undefined) return cached;

  const data = queryFor(ANY_BUSINESS, boxFor(lat, lng, zoom));
  let lastError = "";

  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      // 429 is this instance's per-IP throttle and 504 is it being busy;
      // both mean try the next mirror rather than give up on the tier.
      if (!response.ok) {
        lastError = `${endpoint} returned ${response.status}`;
        continue;
      }

      const body = (await response.json()) as { elements?: Element[] };
      const elements = Array.isArray(body.elements) ? body.elements : [];

      const places = elements
        .map(readElement)
        .filter((place): place is MapsPlace => place !== null);

      if (tiles.size >= TILE_CACHE_MAX) tiles.clear();
      tiles.set(key, places);

      return places;
    } catch (cause) {
      lastError = `${endpoint}: ${String(cause)}`;
    }
  }

  // Retryable: every instance being busy at once is a minute-scale problem,
  // not a reason to strike the only free tier off the waterfall for good.
  throw new PlacesError(`OpenStreetMap is busy — ${lastError}`, 429, true);
};
