/**
 * A flat picture of a patch, and where things sit on it.
 *
 * The live map is ~200 KB of JavaScript and a WebGL context. The summary and
 * the sweep only need to show what was picked, not let anyone move it, so they
 * get an image from the Static Images API instead — same token, same styles,
 * no canvas.
 *
 * The image is requested at an explicit centre and zoom rather than with
 * Mapbox's `/auto/` fit. `/auto/` is one line shorter and gives back a picture
 * whose projection only Mapbox knows, which is fine for a thumbnail and
 * useless the moment something has to be drawn *on* it at a real coordinate.
 * Working out the fit here means `project()` below can put a business exactly
 * where it is, instead of somewhere plausible.
 */
import {
  areaBounds,
  areaFeature,
  thinPoints,
  type HustleArea,
  type LatLng,
} from "./area";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// The whole overlay travels in the URL, and Mapbox rejects requests over
// about 8k. A traced outline is thinned hard for the picture — detail below
// this is invisible at thumbnail size anyway.
const PREVIEW_POINTS = 48;
const PREVIEW_GAP_M = 60;

/** Mapbox serves 512px tiles, so the world is 512px across at zoom 0. */
const TILE_SIZE = 512;

const previewShape = (area: HustleArea): GeoJSON.Feature<GeoJSON.Polygon> => {
  if (!area.polygon || area.polygon.length < 3) return areaFeature(area);

  const thinned: LatLng[] = thinPoints(area.polygon, PREVIEW_GAP_M);
  const points =
    thinned.length > PREVIEW_POINTS
      ? thinned.filter(
          (_, index) =>
            index % Math.ceil(thinned.length / PREVIEW_POINTS) === 0,
        )
      : thinned;

  return areaFeature({ ...area, polygon: points });
};

// --- Web Mercator, normalised to the unit square ----------------------------

const mercX = (lng: number) => (lng + 180) / 360;

const mercY = (lat: number) => {
  // Clamped short of the poles: the projection runs to infinity at ±90, and a
  // patch never goes near them anyway.
  const φ = (Math.min(85.05112878, Math.max(-85.05112878, lat)) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2;
};

const unmercY = (y: number) =>
  (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

export interface MapFrame {
  /** The picture. */
  url: string;
  /**
   * Where a coordinate lands on it, as percentages of the image.
   *
   * Percentages rather than pixels so the caller can scale the picture freely —
   * the frame this is drawn in is sized off the viewport.
   */
  project: (point: LatLng) => { x: number; y: number };
}

interface Options {
  width?: number;
  height?: number;
  theme?: "light" | "dark";
  /** Breathing room around the patch, in image pixels. */
  padding?: number;
}

/**
 * The patch as a picture, plus the projection that put it there.
 *
 * Null when there is no Mapbox token — the caller then shows its panel
 * without art rather than a broken image.
 */
export const staticMapFrame = (
  area: HustleArea,
  { width = 640, height = 320, theme = "light", padding = 40 }: Options = {},
): MapFrame | null => {
  if (!TOKEN) return null;

  const ink = theme === "dark" ? "fafafa" : "111111";

  const feature = previewShape(area);
  // simplestyle-spec: the Static Images API reads these off the feature
  // rather than taking paint properties the way the live map does.
  const styled = {
    ...feature,
    properties: {
      fill: `#${ink}`,
      "fill-opacity": 0.16,
      stroke: `#${ink}`,
      "stroke-width": 2,
      "stroke-opacity": 1,
    },
  };

  const [[west, south], [east, north]] = areaBounds(area);

  const x1 = mercX(west);
  const x2 = mercX(east);
  const y1 = mercY(north);
  const y2 = mercY(south);

  // The zoom at which the patch's box just fits inside the padded image. Both
  // axes are tested and the tighter one wins, or the patch overflows on
  // whichever side is proportionally longer.
  const spanX = Math.max(x2 - x1, 1e-9);
  const spanY = Math.max(y2 - y1, 1e-9);
  const fit = Math.min(
    (width - 2 * padding) / (spanX * TILE_SIZE),
    (height - 2 * padding) / (spanY * TILE_SIZE),
  );
  const zoom = Math.min(20, Math.max(0, Math.log2(Math.max(fit, 1e-9))));

  // Centred on the middle of the box in projected space, not on the average
  // of the corner latitudes — north and south are not symmetric on a Mercator
  // map, and centring on the mean latitude shifts the patch off the picture.
  const centreX = (x1 + x2) / 2;
  const centreY = (y1 + y2) / 2;
  const centreLng = centreX * 360 - 180;
  const centreLat = unmercY(centreY);

  const scale = TILE_SIZE * 2 ** zoom;

  const overlay = `geojson(${encodeURIComponent(JSON.stringify(styled))})`;
  const style = theme === "dark" ? "dark-v11" : "light-v11";

  return {
    url:
      `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${overlay}` +
      `/${centreLng.toFixed(6)},${centreLat.toFixed(6)},${zoom.toFixed(4)}` +
      `/${width}x${height}@2x` +
      `?access_token=${TOKEN}&attribution=false&logo=false`,

    project: (point: LatLng) => ({
      x: ((mercX(point.lng) - centreX) * scale + width / 2) / (width / 100),
      y: ((mercY(point.lat) - centreY) * scale + height / 2) / (height / 100),
    }),
  };
};

/** Just the picture, for callers with nothing to draw on it. */
export const staticMapUrl = (area: HustleArea, options: Options = {}) =>
  staticMapFrame(area, options)?.url ?? null;
