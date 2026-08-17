/**
 * Turning a drawn patch into a list of Google Maps searches.
 *
 * A Maps search takes a point, a zoom, and a phrase — it has no concept of
 * "everywhere inside this shape". So the patch is covered with overlapping
 * tiles, each tile is searched for each trade, and what comes back is filtered
 * against the real area afterwards (Google spills well outside the viewport it
 * is given, which is a feature here: we would rather over-fetch and cut).
 *
 * Imports below are relative rather than `@/...` on purpose: Convex bundles
 * this file for its own runtime and does not resolve the Next.js path alias.
 */

import { destination, distanceBetween, type HustleArea, type LatLng } from "../area";

/**
 * How much ground one search covers.
 *
 * Maps returns at most ~120 results for a query however wide the viewport is,
 * so a tile much bigger than this silently drops businesses off the bottom of
 * a dense high street. Three kilometres is about where a single "hair salon"
 * search stops saturating in a normal town.
 */
export const TILE_RADIUS_M = 3_000;

/** Beyond this the sweep costs more than the leads are worth. */
export const MAX_TILES = 12;

/** Hard ceiling on billed searches for one hunt. */
export const MAX_QUERIES = 48;

/**
 * Pages fetched per search — `start=0` then `start=20`.
 *
 * Page three onward is almost always the same businesses at a wider radius,
 * and each page is billed separately, so two is where the return drops off.
 */
export const PAGES_PER_QUERY = 2;

/** One billed search: a phrase, pinned to a point at a zoom. */
export interface HuntQuery {
  q: string;
  lat: number;
  lng: number;
  zoom: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * The zoom whose viewport is about `radiusM` across from the middle.
 *
 * Web Mercator: a pixel at zoom z and latitude φ is
 * `156543.03 * cos(φ) / 2^z` metres. Solving for the zoom that puts `radiusM`
 * at roughly half a ~1000px viewport gives the expression below.
 *
 * Clamped because Google rejects nonsense: under 10z it stops being a local
 * search and over 17z it sees a single block.
 */
export const zoomFor = (lat: number, radiusM: number) => {
  const zoom = Math.log2((156_543.03392 * Math.cos(toRad(lat)) * 500) / radiusM);
  return Math.min(17, Math.max(10, Math.round(zoom)));
};

/**
 * A grid of tiles of radius `radiusM` covering the whole patch, middle first.
 *
 * A circle of radius r contains a square of side r·√2, so a grid stepping by
 * that leaves no gap between tiles. The ring count is taken from the patch
 * radius, which means the grid always spans the patch's bounding box and
 * therefore the patch.
 */
const gridCover = (area: HustleArea, radiusM: number): LatLng[] => {
  const centre = { lat: area.lat, lng: area.lng };
  const step = radiusM * Math.SQRT2;
  const rings = Math.ceil(area.radiusM / step);
  const tiles: { point: LatLng; from: number }[] = [];

  for (let row = -rings; row <= rings; row++) {
    for (let col = -rings; col <= rings; col++) {
      // North/south first, then east/west from there, so the offset stays true
      // at the latitudes this sells in rather than drifting into an ellipse
      // the way a flat degree offset would.
      const northed = destination(centre.lat, centre.lng, row >= 0 ? 0 : 180, Math.abs(row) * step);
      const point = destination(northed.lat, northed.lng, col >= 0 ? 90 : 270, Math.abs(col) * step);
      const from = distanceBetween(centre, point);

      // A tile whose own reach still touches the patch is worth searching,
      // even when its centre sits outside it.
      if (from <= area.radiusM + radiusM) tiles.push({ point, from });
    }
  }

  // Centre outwards, so the searches the user cares most about run first and
  // a sweep stopped early has covered the middle of the patch.
  return tiles.sort((a, b) => a.from - b.from).map((tile) => tile.point);
};

export interface HuntTiles {
  tiles: LatLng[];
  /** What each tile actually covers, once widened to fit inside MAX_TILES. */
  radiusM: number;
}

/**
 * Tile centres covering the patch, and how much ground each one has to cover.
 *
 * The tile radius is widened until the grid fits inside MAX_TILES rather than
 * the tile list being truncated to it. Truncating looks tidier and is a lie:
 * a 15 km patch would come back with its middle 8 km searched and the rest
 * silently skipped, and the user would read "no businesses out there" off a
 * sweep that never went there. A wider tile can saturate Google's ~120-result
 * cap in a dense district and miss some businesses, which is a real cost — but
 * it is spread evenly across the patch the user drew instead of concentrated
 * into an unsearched ring they cannot see.
 */
export const tilesFor = (area: HustleArea): HuntTiles => {
  if (area.radiusM <= TILE_RADIUS_M) {
    // One search, zoomed to the patch itself rather than to a nominal tile.
    return { tiles: [{ lat: area.lat, lng: area.lng }], radiusM: area.radiusM };
  }

  let radiusM = TILE_RADIUS_M;

  // Bounded: each pass grows the tile by a quarter, so this reaches a single
  // tile covering any legal patch (25 km) well inside the limit.
  for (let pass = 0; pass < 16; pass++) {
    const tiles = gridCover(area, radiusM);
    if (tiles.length <= MAX_TILES) return { tiles, radiusM };
    radiusM = Math.ceil(radiusM * 1.25);
  }

  return { tiles: [{ lat: area.lat, lng: area.lng }], radiusM: area.radiusM };
};

/**
 * The full search plan for a patch.
 *
 * Term-major: every tile is searched for the first trade before any tile is
 * searched for the second. If the plan is cut short — or the user stops
 * watching — they have complete coverage of their best trade rather than a
 * quarter of each.
 *
 * A trade is dropped whole when the budget cannot hold all of its tiles, for
 * the same reason the tiles are widened rather than truncated: half a trade's
 * tiles produces leads from half the patch and reads as a thin high street
 * rather than a half-finished search.
 */
export const planHunt = (area: HustleArea, terms: readonly string[]): HuntQuery[] => {
  const { tiles, radiusM } = tilesFor(area);
  const zoom = zoomFor(area.lat, radiusM);
  const queries: HuntQuery[] = [];

  for (const term of terms) {
    if (queries.length + tiles.length > MAX_QUERIES) break;

    for (const tile of tiles) {
      queries.push({ q: term, lat: tile.lat, lng: tile.lng, zoom });
    }
  }

  return queries;
};

/** How many billed requests a plan will make. */
export const requestsFor = (queries: readonly HuntQuery[]) =>
  queries.length * PAGES_PER_QUERY;

/**
 * The trades a plan actually searches, in order.
 *
 * Read back off the plan rather than off the input, so a term the budget
 * dropped cannot be reported as one that ran.
 */
export const termsIn = (queries: readonly HuntQuery[]) => [
  ...new Set(queries.map((query) => query.q)),
];

/**
 * Is this point inside the patch the user drew?
 *
 * Ray casting against the traced outline when there is one, distance from the
 * centre otherwise. Google answers a viewport, not a shape, so without this
 * a hustle drawn around one neighbourhood fills up with the next town over.
 */
export const withinArea = (area: HustleArea, point: LatLng) => {
  const ring = area.polygon;

  if (!ring || ring.length < 3) {
    return distanceBetween({ lat: area.lat, lng: area.lng }, point) <= area.radiusM;
  }

  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];

    // Degrees are fine here: the crossing test is topological, and a patch is
    // small enough that projection distortion cannot move a point across an
    // edge it was not already sitting on.
    const straddles = a.lat > point.lat !== b.lat > point.lat;
    if (!straddles) continue;

    const cut = a.lng + ((point.lat - a.lat) * (b.lng - a.lng)) / (b.lat - a.lat);
    if (point.lng < cut) inside = !inside;
  }

  return inside;
};
