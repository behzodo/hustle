/**
 * The hunting ground of a hustle: a point and a radius around it.
 *
 * A circle rather than a drawn shape because that is the query the lead
 * search will actually make — latitude, longitude, radius. A freehand
 * polygon has to be chopped into circles to be searched anyway, so it would
 * cost several times as much per area for the same businesses back.
 */

/** Tighter than one street is not a useful search. */
export const RADIUS_MIN_M = 500;

/**
 * Well under the 50 km ceiling place searches impose, and past the point
 * where a single circle still reads as "one town".
 */
export const RADIUS_MAX_M = 25_000;

export const RADIUS_DEFAULT_M = 3_000;

export const RADIUS_STEP_M = 250;

/** How many points a traced shape is thinned to before it is stored. */
export const POLYGON_MAX_POINTS = 200;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface HustleArea {
  /** Human-readable, e.g. "Chapel Allerton, Leeds". Shown on the card. */
  label: string;
  /**
   * The centre and reach of the patch.
   *
   * Always present, even for a traced shape, where they describe the circle
   * that encloses it. Place searches take a point and a radius and nothing
   * else, so keeping these filled in means the lead search has one code path
   * whichever way the area was picked — the outline then narrows the results.
   */
  lat: number;
  lng: number;
  radiusM: number;
  /** The traced outline, when the area was drawn rather than dialled in. */
  polygon?: LatLng[];
}

/** "800 m" under a kilometre, "3.5 km" over it. */
export const formatRadius = (radiusM: number) =>
  radiusM < 1000
    ? `${Math.round(radiusM)} m`
    : `${(radiusM / 1000).toFixed(radiusM % 1000 === 0 ? 0 : 1)} km`;

/** Roughly how far across the circle is, for the "about N km wide" line. */
export const formatDiameter = (radiusM: number) => formatRadius(radiusM * 2);

const EARTH_RADIUS_M = 6_378_137;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Walk `distanceM` from a point along `bearingDeg`, on the sphere.
 *
 * Not a flat degree offset: away from the equator a degree of longitude is
 * much shorter than a degree of latitude, so the flat version draws a visible
 * ellipse — and this product sells in northern towns where that is obvious.
 */
export const destination = (
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceM: number,
): { lat: number; lng: number } => {
  const angular = distanceM / EARTH_RADIUS_M;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lng1 = toRad(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: toDeg(lat2), lng: toDeg(lng2) };
};

/** Metres between two points — how far the resize handle was dragged. */
export const distanceBetween = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = lat2 - lat1;
  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Compass bearing from a to b, so the handle stays under the cursor. */
export const bearingBetween = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

export const clampRadius = (radiusM: number) =>
  Math.min(RADIUS_MAX_M, Math.max(RADIUS_MIN_M, Math.round(radiusM)));

/** The circle as a GeoJSON ring, so Mapbox can fill it. */
const circleRing = (lat: number, lng: number, radiusM: number, steps = 96) => {
  const ring: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const point = destination(lat, lng, (i * 360) / steps, radiusM);
    ring.push([point.lng, point.lat]);
  }

  return ring;
};

/** The circle as a Feature, ready to hand to a Mapbox GeoJSON source. */
export const circleFeature = (area: {
  lat: number;
  lng: number;
  radiusM: number;
}): GeoJSON.Feature<GeoJSON.Polygon> => ({
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [circleRing(area.lat, area.lng, area.radiusM)],
  },
});

/** Corner-to-corner bounds of the circle, for fitting the map to it. */
export const circleBounds = (area: {
  lat: number;
  lng: number;
  radiusM: number;
}): [[number, number], [number, number]] => boundsOf(circleRing(area.lat, area.lng, area.radiusM, 24));

const boundsOf = (
  ring: [number, number][],
): [[number, number], [number, number]] => {
  const lngs = ring.map(([lng]) => lng);
  const lats = ring.map(([, lat]) => lat);

  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
};

// --- Traced shapes ----------------------------------------------------------

/**
 * The middle of a drawn shape, taken as the centre of its bounding box.
 *
 * Not the average of the points: a shape traced slowly round one side has
 * far more points there, which drags an averaged centre off toward the
 * hand's dawdle and inflates the enclosing radius for no reason.
 */
export const centreOf = (points: LatLng[]): LatLng => {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);

  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
};

/** The smallest radius from `centre` that still covers every point. */
export const enclosingRadius = (centre: LatLng, points: LatLng[]) =>
  points.reduce((far, point) => Math.max(far, distanceBetween(centre, point)), 0);

/**
 * Drop points that are closer together than `minGapM`, then cap the count.
 *
 * A mouse traced across a map emits a point every few pixels, which is far
 * more than the shape needs and would push a big scribble toward the document
 * size limit for nothing.
 */
export const thinPoints = (points: LatLng[], minGapM: number): LatLng[] => {
  const kept: LatLng[] = [];

  for (const point of points) {
    const last = kept[kept.length - 1];
    if (!last || distanceBetween(last, point) >= minGapM) kept.push(point);
  }

  if (kept.length <= POLYGON_MAX_POINTS) return kept;

  // Still too many after thinning — keep every nth so the shape survives.
  const stride = Math.ceil(kept.length / POLYGON_MAX_POINTS);
  return kept.filter((_, index) => index % stride === 0);
};

const closedRing = (points: LatLng[]): [number, number][] => {
  const ring = points.map((p) => [p.lng, p.lat] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];

  // GeoJSON wants the ring closed; a traced shape ends wherever the hand
  // stopped.
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push(first);
  }

  return ring;
};

/** A traced outline as a GeoJSON Feature. */
export const polygonFeature = (
  points: LatLng[],
): GeoJSON.Feature<GeoJSON.Polygon> => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Polygon", coordinates: [closedRing(points)] },
});

/** Whatever shape this area actually is — traced outline, or its circle. */
export const areaFeature = (area: HustleArea) =>
  area.polygon && area.polygon.length >= 3
    ? polygonFeature(area.polygon)
    : circleFeature(area);

/** Bounds to fit the map to, for either shape. */
export const areaBounds = (area: HustleArea) =>
  area.polygon && area.polygon.length >= 3
    ? boundsOf(closedRing(area.polygon))
    : circleBounds(area);
