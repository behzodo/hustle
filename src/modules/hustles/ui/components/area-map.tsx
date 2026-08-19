"use client";

import mapboxgl from "mapbox-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapPinIcon, PencilSimpleIcon } from "@phosphor-icons/react";

import "mapbox-gl/dist/mapbox-gl.css";

import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { useCurrentTheme } from "@/hooks/use-current-theme";

import {
  areaBounds,
  areaFeature,
  bearingBetween,
  centreOf,
  clampRadius,
  destination,
  distanceBetween,
  enclosingRadius,
  formatDiameter,
  formatRadius,
  thinPoints,
  RADIUS_DEFAULT_M,
  RADIUS_MAX_M,
  RADIUS_MIN_M,
  RADIUS_STEP_M,
  type HustleArea,
  type LatLng,
} from "../../area";
import {
  describePoint,
  hasMapbox,
  isAllowedCountry,
  isPreciseType,
  searchPlaces,
} from "../../geocode";

/**
 * The patch is drawn in the palette's own ink — near-black on the light map,
 * near-white on the dark one, matching `--primary` either side.
 *
 * The house rule is that black is the accent, so a coloured overlay would be
 * the one saturated thing in the entire product. Mapbox parses its own colour
 * strings and will not take an `oklch()` var, so the two ends of that ramp
 * are written out here.
 */
const INK = { light: "#111111", dark: "#fafafa" } as const;

const styleFor = (ink: string) =>
  ink === INK.dark
    ? "mapbox://styles/mapbox/dark-v11"
    : "mapbox://styles/mapbox/light-v11";

const SOURCE_ID = "hustle-area";
const FILL_LAYER = "hustle-area-fill";
const LINE_LAYER = "hustle-area-line";
const DRAFT_SOURCE = "hustle-draft";
const DRAFT_LAYER = "hustle-draft-line";

const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** Points closer together than this add detail no one asked for. */
const TRACE_GAP_M = 25;

type Mode = "pin" | "draw";

const MODES = [
  { key: "pin", label: "Pin", icon: MapPinIcon },
  { key: "draw", label: "Draw", icon: PencilSimpleIcon },
] as const;

/** A figure and its label, set the way the dashboard sets its tiles. */
const Figure = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="eyebrow text-muted-foreground font-medium">{label}</p>
    <p className="font-display mt-1 text-lg tabular-nums">{value}</p>
  </div>
);

interface AreaMapProps {
  value: HustleArea | null;
  /** Null when a pick has to be taken back — a pin dropped outside cover. */
  onChange: (area: HustleArea | null) => void;
  /** Seeds the first view — the town from onboarding. */
  initialQuery?: string;
  disabled?: boolean;
}

export const AreaMap = ({
  value,
  onChange,
  initialQuery,
  disabled,
}: AreaMapProps) => {
  const theme = useCurrentTheme();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // The grab handle sitting on the circle's edge.
  const handleRef = useRef<mapboxgl.Marker | null>(null);
  // Which way round the circle it sits. Follows wherever it was last dragged
  // to, so it stays under the cursor instead of snapping back to due east.
  const handleBearingRef = useRef(90);

  // Map event handlers are registered once and would otherwise close over the
  // first render's props forever.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const inkRef = useRef<string>(INK.light);
  inkRef.current = theme === "dark" ? INK.dark : INK.light;
  // The style the map is actually on, so the theme effect can tell a real
  // change from a re-render.
  const styleRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mode, setMode] = useState<Mode>("pin");
  const modeRef = useRef<Mode>("pin");
  modeRef.current = mode;

  const [tracing, setTracing] = useState(false);
  const [tooBig, setTooBig] = useState(false);
  const [outside, setOutside] = useState(false);
  // The pin is somewhere the geocoder cannot name a street. Advisory, not
  // blocking — see the note where it is set.
  const [vague, setVague] = useState(false);
  const traceRef = useRef<LatLng[] | null>(null);

  // A camera move asked for before the map finished loading. Mapbox silently
  // does nothing in that case, which is how the map ended up sat at world
  // zoom while the pin was already on a town.
  const pendingFitRef = useRef<[[number, number], [number, number]] | null>(null);

  const fitTo = useCallback((area: HustleArea, duration = 600) => {
    const bounds = areaBounds(area);
    const map = mapRef.current;

    if (!map || !map.isStyleLoaded()) {
      pendingFitRef.current = bounds;
      return;
    }

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(bounds, { padding: 72, duration: still ? 0 : duration, maxZoom: 16 });
  }, []);

  /**
   * Move the pin and name where it landed.
   *
   * The point is applied immediately and the label filled in when the reverse
   * lookup returns — waiting on the network before the pin moves would make
   * dragging feel broken.
   */
  const commitPoint = useCallback(async (lat: number, lng: number) => {
    const previous = valueRef.current;
    const radiusM = previous?.radiusM ?? RADIUS_DEFAULT_M;

    // Dropping a pin replaces any traced shape — two areas at once would be
    // ambiguous, and the shape is no longer where they just clicked.
    onChangeRef.current({
      label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      lat,
      lng,
      radiusM,
    });
    setOutside(false);
    setVague(false);

    const found = await describePoint(lat, lng);
    if (!found) return;

    // Another drag may have landed while the lookup was in flight; only name
    // the point that is still current.
    const current = valueRef.current;
    if (current?.lat !== lat || current?.lng !== lng) return;

    // A null country means the lookup came back thin, not that the pin is
    // abroad — refusing on that would reject good pins over a geocoder blip.
    if (found.country !== null && !isAllowedCountry(found.country)) {
      setOutside(true);
      onChangeRef.current(previous);
      return;
    }

    /**
     * The label can be a town while the pin is nowhere near one.
     *
     * Reverse geocoding returns the smallest feature *containing* the point,
     * so a pin dropped in the sea inside a coastal postcode comes back named
     * after that postcode's town and reads as a perfectly good patch. The
     * feature type is what gives it away — a street means buildings, a
     * postcode means the geocoder found no street to name.
     *
     * A warning rather than a refusal, on the same reasoning as the country
     * check above: this is a heuristic about map data, and a heuristic must
     * not be the thing that stops someone hunting a town they can see under
     * their own pin.
     */
    setVague(!isPreciseType(found.featureType));

    onChangeRef.current({ ...current, label: found.label });
  }, []);

  /** Turn a finished trace into the area, or refuse it if it is too wide. */
  const commitTrace = useCallback(
    async (raw: LatLng[]) => {
      const polygon = thinPoints(raw, TRACE_GAP_M);
      if (polygon.length < 3) return;

      const centre = centreOf(polygon);
      const reach = enclosingRadius(centre, polygon);

      if (reach > RADIUS_MAX_M) {
        setTooBig(true);
        return;
      }

      setTooBig(false);
      setOutside(false);
      setVague(false);

      const previous = valueRef.current;
      const area: HustleArea = {
        label: `${centre.lat.toFixed(4)}, ${centre.lng.toFixed(4)}`,
        lat: centre.lat,
        lng: centre.lng,
        // The outline is the real shape; this is the circle a place search
        // has to be given, so it is never allowed below the search minimum.
        radiusM: clampRadius(reach),
        polygon,
      };

      onChangeRef.current(area);
      fitTo(area);

      // Panning is disabled while the pen is armed, and the shape is drawn —
      // leaving it armed makes the map feel stuck.
      setMode("pin");

      const found = await describePoint(centre.lat, centre.lng);
      if (!found) return;

      const current = valueRef.current;
      if (current?.lat !== centre.lat || current?.lng !== centre.lng) return;

      if (found.country !== null && !isAllowedCountry(found.country)) {
        setOutside(true);
        onChangeRef.current(previous);
        return;
      }

      // Same check as a dropped pin — a shape traced round a bay has the same
      // problem as a pin dropped in one.
      setVague(!isPreciseType(found.featureType));

      onChangeRef.current({ ...current, label: found.label });
    },
    [fitTo],
  );

  /** Paint the shape, creating its sources and layers if the style is new. */
  const draw = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const area = valueRef.current;
    const data = area ? areaFeature(area) : EMPTY;
    const ink = inkRef.current;

    const existing = map.getSource(SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined;

    if (existing) {
      existing.setData(data);
      // The style may not have changed, but the theme might have.
      map.setPaintProperty(FILL_LAYER, "fill-color", ink);
      map.setPaintProperty(LINE_LAYER, "line-color", ink);
      map.setPaintProperty(DRAFT_LAYER, "line-color", ink);
      return;
    }

    map.addSource(SOURCE_ID, { type: "geojson", data });
    map.addSource(DRAFT_SOURCE, { type: "geojson", data: EMPTY });

    map.addLayer({
      id: FILL_LAYER,
      type: "fill",
      source: SOURCE_ID,
      paint: { "fill-color": ink, "fill-opacity": 0.16 },
    });

    map.addLayer({
      id: LINE_LAYER,
      type: "line",
      source: SOURCE_ID,
      paint: { "line-color": ink, "line-width": 2 },
    });

    // The line being traced right now, dashed so it reads as unfinished.
    map.addLayer({
      id: DRAFT_LAYER,
      type: "line",
      source: DRAFT_SOURCE,
      paint: { "line-color": ink, "line-width": 2.5, "line-dasharray": [2, 1.5] },
    });
  }, []);

  const paintDraft = useCallback((points: LatLng[] | null) => {
    const source = mapRef.current?.getSource(DRAFT_SOURCE) as
      | mapboxgl.GeoJSONSource
      | undefined;

    if (!source) return;

    source.setData(
      points && points.length > 1
        ? {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: points.map((p) => [p.lng, p.lat]),
            },
          }
        : EMPTY,
    );
  }, []);

  // next-themes knows nothing on the first render, so `theme` is undefined
  // until it mounts. Building the map before then meant building it light and
  // immediately calling setStyle — which swaps the style out from under a load
  // that has not finished, leaving a map that paints its background and never
  // fetches a tile. One tick of waiting removes the race entirely.
  const themeKnown = theme !== undefined;

  // --- Create the map once. -------------------------------------------------
  useEffect(() => {
    if (!themeKnown || !hasMapbox || !containerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

    const start = valueRef.current;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      // Started on the theme that is already showing, not always the light
      // one — the style switch below cannot run until the first has loaded,
      // so defaulting to light flashed a white map on a dark page.
      style: (styleRef.current = styleFor(inkRef.current)),
      center: start ? [start.lng, start.lat] : [-96, 40],
      zoom: start ? 11 : 3,
      // v3 defaults to a globe. Nothing here is world-scale, and a flat map
      // keeps a circle looking like a circle.
      projection: "mercator",
      attributionControl: true,
    });

    // Deliberately no `maxBounds`. Penning the camera into North America
    // sounds tidy, but its northern edge sits near the latitude where the
    // Mercator projection runs away to infinity, and the constraint it
    // produced left the map painting its background and no layers at all.
    // Picking outside the US and Canada is already refused on the way in, by
    // the country check in commitPoint, which is the check that matters.

    // Surfaces a failing style or tile request in the console instead of
    // leaving a blank rectangle to guess at.
    map.on("error", (event) => {
      console.error("[area-map]", event.error?.message ?? event);
    });

    // A tilted, rotated map buys nothing here and makes a circle hard to read
    // as a circle.
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    const pin = document.createElement("div");
    pin.className = "hustle-pin";

    const marker = new mapboxgl.Marker({ element: pin, draggable: true });

    marker.on("dragend", () => {
      if (disabledRef.current) return;
      const { lat, lng } = marker.getLngLat();
      void commitPoint(lat, lng);
    });

    // --- Drag the edge to size the circle. ---------------------------------
    const grip = document.createElement("div");
    grip.className = "hustle-grip";

    const handle = new mapboxgl.Marker({ element: grip, draggable: true });

    const resizeFromHandle = () => {
      const area = valueRef.current;
      if (!area || disabledRef.current) return;

      const at = handle.getLngLat();
      const centre = { lat: area.lat, lng: area.lng };

      // Both come from the cursor, so the handle lands where it was dropped —
      // except at the limits, where the clamp is what makes the edge visibly
      // refuse to go further.
      handleBearingRef.current = bearingBetween(centre, at);
      onChangeRef.current({
        ...area,
        radiusM: clampRadius(distanceBetween(centre, at)),
      });
    };

    handle.on("drag", resizeFromHandle);
    handle.on("dragend", resizeFromHandle);

    // --- Freehand tracing. -------------------------------------------------
    const startTrace = (point: LatLng) => {
      if (modeRef.current !== "draw" || disabledRef.current) return;
      traceRef.current = [point];
      setTracing(true);
      setTooBig(false);
    };

    const extendTrace = (point: LatLng) => {
      const trace = traceRef.current;
      if (!trace) return;

      const last = trace[trace.length - 1];
      // Raw pointer moves land on top of each other; anything under a few
      // metres is noise the finished shape does not need.
      if (distanceBetween(last, point) < 5) return;

      trace.push(point);
      paintDraft(trace);
    };

    const endTrace = () => {
      const trace = traceRef.current;
      traceRef.current = null;
      setTracing(false);
      paintDraft(null);

      if (trace && trace.length >= 3) void commitTrace(trace);
    };

    map.on("mousedown", (event) => {
      if (modeRef.current !== "draw") return;
      event.preventDefault();
      startTrace(event.lngLat);
    });

    map.on("touchstart", (event) => {
      if (modeRef.current !== "draw") return;
      event.preventDefault();
      startTrace(event.lngLat);
    });

    map.on("mousemove", (event) => extendTrace(event.lngLat));
    map.on("touchmove", (event) => extendTrace(event.lngLat));

    map.on("mouseup", endTrace);
    map.on("touchend", endTrace);
    // Releasing outside the canvas would otherwise leave the pen stuck down.
    map.getCanvas().addEventListener("mouseleave", endTrace);

    map.on("click", (event) => {
      if (disabledRef.current || modeRef.current === "draw") return;
      void commitPoint(event.lngLat.lat, event.lngLat.lng);
    });

    map.on("load", () => {
      setReady(true);
      // The panel animates its width between steps, so the container can be a
      // different size by the time the style is up.
      map.resize();
      draw();

      // A fit asked for while the style was still loading.
      const pending = pendingFitRef.current;
      if (pending) {
        pendingFitRef.current = null;
        map.fitBounds(pending, { padding: 72, duration: 0, maxZoom: 16 });
      }
    });

    // setStyle throws every layer away, so the shape has to be rebuilt each
    // time the theme flips.
    map.on("style.load", draw);

    mapRef.current = map;
    markerRef.current = marker;
    handleRef.current = handle;

    return () => {
      map.getCanvas().removeEventListener("mouseleave", endTrace);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      handleRef.current = null;
      // Or a remount would think the fresh map is already on the right style
      // and skip the switch.
      styleRef.current = null;
      setReady(false);
    };
  }, [themeKnown, commitPoint, commitTrace, draw, paintDraft]);

  // --- Arm or disarm the pen. -----------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const drawing = mode === "draw";

    // Dragging has to mean "trace", not "pan", or the shape can never be
    // drawn at all.
    if (drawing) {
      map.dragPan.disable();
      map.boxZoom.disable();
    } else {
      map.dragPan.enable();
      map.boxZoom.enable();
    }

    map.getCanvas().style.cursor = drawing ? "crosshair" : "";
  }, [mode, ready]);

  // --- Follow the theme. ----------------------------------------------------
  //
  // Gated on `ready`: setStyle before the first style has loaded breaks the
  // map's sources. The map is now built on the right style to begin with, so
  // this only ever runs for a real toggle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const wanted = styleFor(theme === "dark" ? INK.dark : INK.light);

    // setStyle tears down every layer, so it must not fire on re-renders that
    // did not actually change the theme.
    if (wanted === styleRef.current) return;

    styleRef.current = wanted;
    map.setStyle(wanted);
  }, [theme, ready]);

  // --- Keep pin, handle and shape on the current value. ---------------------
  //
  // Deliberately does not touch the camera: the value changes on every drag,
  // and a map that recentres itself under the cursor is unusable. Camera
  // moves are made explicitly, through fitTo.
  useEffect(() => {
    const marker = markerRef.current;
    const handle = handleRef.current;
    const map = mapRef.current;
    if (!marker || !handle || !map) return;

    // A traced shape has no centre pin to drag and no single radius to grab;
    // the outline is the thing, and both markers would just sit on top of it.
    const showMarkers = value !== null && !value.polygon;

    if (showMarkers && value) {
      marker.setLngLat([value.lng, value.lat]);
      if (!marker.getElement().isConnected) marker.addTo(map);

      const edge = destination(
        value.lat,
        value.lng,
        handleBearingRef.current,
        value.radiusM,
      );

      handle.setLngLat([edge.lng, edge.lat]);
      if (!handle.getElement().isConnected) handle.addTo(map);
    } else {
      marker.remove();
      handle.remove();
    }

    draw();
  }, [value, draw, ready]);

  // --- Seed from the onboarding town, once. ---------------------------------
  useEffect(() => {
    if (value || !initialQuery || !hasMapbox) return;

    let cancelled = false;
    setLocating(true);

    searchPlaces(initialQuery)
      .then((places) => {
        if (cancelled || valueRef.current) return;

        /**
         * Only a real town seeds a patch.
         *
         * This is the one place an area is set without anybody looking at it,
         * so a bad result here is a hustle that sweeps somewhere the user
         * never chose. Someone whose town is saved as a postcode gets the
         * first result Mapbox has that is an actual place, and if there is
         * none they get an unseeded map saying "tap to drop a pin" — which is
         * a smaller problem than a patch centred eighty kilometres out to sea
         * under the right town's name.
         */
        const place = places.find((candidate) =>
          isPreciseType(candidate.featureType),
        );

        if (!place) return;

        const area: HustleArea = {
          label: place.context ? `${place.name}, ${place.context}` : place.name,
          lat: place.lat,
          lng: place.lng,
          radiusM: RADIUS_DEFAULT_M,
        };

        onChangeRef.current(area);
        fitTo(area, 0);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLocating(false);
      });

    return () => {
      cancelled = true;
    };
    // Runs for the initial town only — `value` is read, not depended on, so a
    // later edit cannot retrigger the seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, fitTo]);

  if (!hasMapbox) {
    return (
      <div className="border-muted-foreground/25 rounded-2xl border border-dashed p-6 text-center">
        <p className="text-muted-foreground text-sm text-balance">
          The map needs a Mapbox token. Set{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> and
          restart the dev server.
        </p>
      </div>
    );
  }

  const drawn = Boolean(value?.polygon);

  const problem = tooBig
    ? `Too wide — keep it under ${formatRadius(RADIUS_MAX_M)} from the middle`
    : outside
      ? "The US and Canada only for now — pick a patch there"
      : null;

  // Advisory, and kept apart from `problem`: the patch is usable, it just
  // probably is not where they think it is.
  const warning =
    !problem && vague
      ? "No streets at this pin — it may be over water or open country. Drag it onto a town."
      : null;

  const hint =
    problem ??
    warning ??
    (mode === "draw"
      ? tracing
        ? "Let go to close the shape"
        : "Hold and drag to draw round the patch"
      : !value
        ? locating
          ? "Finding your town"
          : "Tap the map to drop a pin, or hit Draw"
        : null);

  return (
    <div>
      {/* Scoped here rather than in globals.css: nothing else on the site has
          a map, and these are all overrides of Mapbox's own chrome. */}
      <style>{`
        .hustle-map { --ink: ${INK.light}; --paper: #fff; }
        .dark .hustle-map { --ink: ${INK.dark}; --paper: oklch(0.2050 0 0); }

        .hustle-pin,
        .hustle-grip {
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          cursor: grab;
        }
        .hustle-pin:active,
        .hustle-grip:active { cursor: grabbing; }

        /* Solid: this is the place itself. */
        .hustle-pin {
          background: var(--ink);
          border: 3px solid var(--paper);
          box-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
        }

        /* Hollow: this is the edge of the patch, not a second place. */
        .hustle-grip {
          background: var(--paper);
          border: 3px solid var(--ink);
          box-shadow: 0 1px 4px rgb(0 0 0 / 0.25);
          transition: transform 150ms ease;
        }
        .hustle-grip:hover,
        .hustle-grip:active { transform: scale(1.3); }

        /* Mapbox's default control is a white box with its own radius and
           shadow — the one thing on the page that looks bought in. */
        .hustle-map .mapboxgl-ctrl-group {
          background: var(--paper);
          border: 1px solid rgb(128 128 128 / 0.25);
          border-radius: 10px;
          box-shadow: none;
          overflow: hidden;
        }
        .hustle-map .mapboxgl-ctrl-group button + button {
          border-top: 1px solid rgb(128 128 128 / 0.25);
        }
        .hustle-map .mapboxgl-ctrl-group button .mapboxgl-ctrl-icon {
          filter: none;
        }
        .dark .hustle-map .mapboxgl-ctrl-group button .mapboxgl-ctrl-icon {
          filter: invert(1);
        }
        .hustle-map .mapboxgl-ctrl-attrib {
          background: transparent;
          font-size: 10px;
        }
        .hustle-map .mapboxgl-ctrl-attrib a { color: inherit; opacity: 0.55; }
        .hustle-map .mapboxgl-ctrl-bottom-left { opacity: 0.55; }

        @media (prefers-reduced-motion: reduce) {
          .hustle-grip { transition: none; }
        }
      `}</style>

      {/* Map and readout are one panel, the same treatment the dashboard uses,
          so this reads as part of the product rather than an embed. Side by
          side once there is room: stacked, the readout pushes the buttons off
          the bottom of the screen and the step opens half-scrolled. */}
      <div
        className={cn(
          "hustle-map dark:bg-sidebar overflow-hidden rounded-2xl border bg-white",
          value && "lg:grid lg:grid-cols-[1fr_20rem]",
        )}
      >
        <div className="relative">
          <div
            ref={containerRef}
            className={cn(
              // Sized off the viewport, not a fixed number: the map should be
              // as tall as the screen has left over once the heading and the
              // buttons are placed, so the whole step lands on one screen.
              "h-[clamp(20rem,calc(100svh_-_26rem),44rem)] w-full",
              disabled && "pointer-events-none opacity-60",
            )}
          />

          {/* Floating, like a tool on the map rather than a form control
              parked above it. */}
          <div className="bg-background/85 absolute top-3 left-3 flex gap-1 rounded-xl border p-1 shadow-sm backdrop-blur">
            {MODES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                aria-pressed={mode === key}
                onClick={() => setMode(key)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors",
                  "focus-visible:ring-ring outline-none focus-visible:ring-2",
                  mode === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" weight={mode === key ? "fill" : "regular"} />
                {label}
              </button>
            ))}
          </div>

          {hint && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
              <p
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-1 rounded-full border px-4 py-2 text-sm shadow-sm backdrop-blur duration-200",
                  problem
                    ? "border-destructive/30 bg-destructive text-destructive-foreground"
                    : // Outlined rather than filled: this one is telling them
                      // to look again, not refusing what they did.
                      warning
                      ? "border-destructive/50 bg-background/95 text-foreground"
                      : "bg-background/90",
                )}
              >
                {hint}
              </p>
            </div>
          )}
        </div>

        {value && (
          <div className="overflow-y-auto border-t p-4 md:p-5 lg:border-t-0 lg:border-l">
            <p className="eyebrow text-muted-foreground font-medium">
              Your patch
            </p>
            <p className="font-display mt-1.5 text-xl leading-tight text-balance">
              {value.label}
            </p>

            <div className="mt-5 flex items-start gap-8">
              <Figure label="Across" value={formatDiameter(value.radiusM)} />
              <Figure label="Shape" value={drawn ? "Traced" : "Circle"} />
            </div>

            {drawn ? (
              <p className="text-muted-foreground mt-5 text-sm">
                Hit <span className="text-foreground font-medium">Draw</span> to
                trace it again, or{" "}
                <span className="text-foreground font-medium">Pin</span> and tap
                the map to go back to a circle.
              </p>
            ) : (
              <div className="mt-5">
                <div className="mb-2.5 flex items-baseline justify-between gap-4">
                  <span className="eyebrow text-muted-foreground font-medium">
                    Radius
                  </span>
                  <span className="font-display text-sm tabular-nums">
                    {formatRadius(value.radiusM)}
                  </span>
                </div>

                <Slider
                  min={RADIUS_MIN_M}
                  max={RADIUS_MAX_M}
                  step={RADIUS_STEP_M}
                  disabled={disabled}
                  value={[value.radiusM]}
                  onValueChange={([next]) => onChange({ ...value, radiusM: next })}
                  // Fitting on every drag tick would zoom the map out from
                  // under the thumb; once on release is enough.
                  onValueCommit={([next]) => fitTo({ ...value, radiusM: next }, 400)}
                />

                <p className="text-muted-foreground mt-3 text-sm">
                  Drag the filled pin to move the patch, the hollow one to
                  resize it.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
