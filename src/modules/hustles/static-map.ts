/**
 * A flat picture of a patch, for the review step.
 *
 * The live map is ~200 KB of JavaScript and a WebGL context. The summary only
 * needs to show what was picked, not let anyone move it, so it gets an image
 * from the Static Images API instead — same token, same styles, no canvas.
 */
import {
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

/** Null when there is no token — the caller then shows the panel without art. */
export const staticMapUrl = (
  area: HustleArea,
  {
    width = 640,
    height = 320,
    theme = "light",
  }: { width?: number; height?: number; theme?: "light" | "dark" } = {},
): string | null => {
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

  const overlay = `geojson(${encodeURIComponent(JSON.stringify(styled))})`;
  const style = theme === "dark" ? "dark-v11" : "light-v11";

  return (
    `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${overlay}` +
    `/auto/${width}x${height}@2x` +
    `?access_token=${TOKEN}&padding=40&attribution=false&logo=false`
  );
};
