/**
 * Place lookup, both ways, against the Mapbox Geocoding API.
 *
 * Called straight from the browser on purpose. The token is a public `pk.*`
 * one that ships in the bundle anyway, so proxying it through a route would
 * add a hop and protect nothing — restrict it by URL in the Mapbox dashboard
 * instead. Geocoding is free well past anything this wizard will do.
 */
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export const hasMapbox = TOKEN.length > 0;

const ENDPOINT = "https://api.mapbox.com/search/geocode/v6";

/**
 * The only places a hustle can hunt for now.
 *
 * Both the search filter and the check on a dropped pin read this, so opening
 * up another country is one line here rather than a hunt through the map.
 */
export const ALLOWED_COUNTRIES = ["us", "ca"] as const;

export const isAllowedCountry = (code: string | null) =>
  code !== null && (ALLOWED_COUNTRIES as readonly string[]).includes(code);

/**
 * Feature types precise enough to hunt from.
 *
 * Mapbox answers with the smallest thing that contains the point, so what it
 * returns is a statement about what is there: a street or an address means
 * buildings, a `place` means a town. Anything coarser means the geocoder could
 * not find a town at all and fell back to the administrative shape around it.
 *
 * That distinction is not cosmetic. A postcode is returned with its centroid,
 * and a centroid is only near the addresses when the postcode is compact —
 * ZCTA 33037 is named for Key Largo and takes in most of Everglades National
 * Park and Florida Bay, so its centre sits about eighty kilometres out to sea.
 * A hustle seeded there searches open water, finds nothing, and reads as a
 * town with no businesses in it.
 */
const PRECISE_TYPES = new Set([
  "address",
  "street",
  "neighborhood",
  "locality",
  "place",
]);

/** Is this a real place, or the middle of an administrative boundary? */
export const isPreciseType = (featureType: string | null) =>
  featureType !== null && PRECISE_TYPES.has(featureType);

export interface Place {
  /** Stable enough to key a list on; Mapbox calls it `mapbox_id`. */
  id: string;
  /** "Chapel Allerton" — the bit to show big. */
  name: string;
  /** "Leeds, England, United Kingdom" — the bit to show small. */
  context: string;
  lat: number;
  lng: number;
  /** "place", "postcode", "region"… — see isPreciseType. */
  featureType: string | null;
}

interface MapboxFeature {
  id?: string;
  properties?: {
    mapbox_id?: string;
    name?: string;
    place_formatted?: string;
    full_address?: string;
    coordinates?: { longitude?: number; latitude?: number };
    context?: { country?: { country_code?: string } };
    feature_type?: string;
  };
  geometry?: { coordinates?: [number, number] };
}

const countryOf = (feature: MapboxFeature) =>
  feature.properties?.context?.country?.country_code?.toLowerCase() ?? null;

const toPlace = (feature: MapboxFeature, index: number): Place | null => {
  const props = feature.properties ?? {};

  // v6 puts the point on `properties.coordinates`, but keeps a GeoJSON
  // geometry too. Either will do; take whichever is present.
  const lng = props.coordinates?.longitude ?? feature.geometry?.coordinates?.[0];
  const lat = props.coordinates?.latitude ?? feature.geometry?.coordinates?.[1];

  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const name = props.name ?? props.full_address ?? "Unnamed place";

  return {
    id: props.mapbox_id ?? feature.id ?? `${index}-${lat},${lng}`,
    name,
    // `place_formatted` is everything after the name. Falls back to trimming
    // the name off the full address, which is how v6 composes it anyway.
    context:
      props.place_formatted ??
      props.full_address?.replace(`${name}, `, "") ??
      "",
    lat,
    lng,
    featureType: props.feature_type ?? null,
  };
};

/**
 * Search places by name.
 *
 * `proximity` biases toward what is already on screen, so someone looking at
 * Yorkshire who types "Bradford" gets the one up the road rather than the one
 * in Pennsylvania.
 */
export const searchPlaces = async (
  query: string,
  options: { proximity?: { lat: number; lng: number }; signal?: AbortSignal } = {},
): Promise<Place[]> => {
  const trimmed = query.trim();
  if (!hasMapbox || trimmed.length < 2) return [];

  const url = new URL(`${ENDPOINT}/forward`);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("access_token", TOKEN);
  url.searchParams.set("limit", "5");
  // Filtered at the API rather than after the fact, so all five results are
  // usable instead of two survivors and three greyed-out rows.
  url.searchParams.set("country", ALLOWED_COUNTRIES.join(","));

  if (options.proximity) {
    url.searchParams.set(
      "proximity",
      `${options.proximity.lng},${options.proximity.lat}`,
    );
  }

  const res = await fetch(url, { signal: options.signal });
  if (!res.ok) return [];

  const body = (await res.json()) as { features?: MapboxFeature[] };

  return (body.features ?? [])
    .map(toPlace)
    .filter((place): place is Place => place !== null);
};

/**
 * What is at this point — used to name a pin the user dropped themselves, and
 * to tell whether they dropped it somewhere we cover.
 *
 * Best effort on the name: a hustle whose area says "53.7997, -1.5492" is
 * uglier than one that says "Headingley, Leeds", but neither is worth failing
 * the wizard over. `country` is null when the lookup gave nothing back, which
 * callers treat as "unknown", not as "rejected" — a geocoder blip should not
 * refuse a pin the user can plainly see is in Ohio.
 *
 * `featureType` comes back too, because the name alone cannot be trusted to
 * describe the pin. Reverse geocoding answers with the smallest feature that
 * *contains* the point, so a pin in the sea inside a coastal postcode is
 * returned named after the town that postcode belongs to — a label reading
 * "Key Largo, Florida" over eighty kilometres of open water. The type is what
 * gives that away: a real high street comes back "address" or "street", and
 * water comes back "postcode".
 */
export const describePoint = async (
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<{
  label: string;
  country: string | null;
  featureType: string | null;
} | null> => {
  if (!hasMapbox) return null;

  const url = new URL(`${ENDPOINT}/reverse`);
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("access_token", TOKEN);
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;

    const body = (await res.json()) as { features?: MapboxFeature[] };
    const feature = body.features?.[0];
    const place = feature ? toPlace(feature, 0) : null;

    if (!feature || !place) return null;

    return {
      label: place.context ? `${place.name}, ${place.context}` : place.name,
      country: countryOf(feature),
      featureType: place.featureType,
    };
  } catch {
    return null;
  }
};
