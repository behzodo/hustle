"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { MapPinIcon } from "@phosphor-icons/react";

import type { HustleArea } from "@/modules/hustles/area";
import { staticMapFrame } from "@/modules/hustles/static-map";

/**
 * The sweep over the patch, before anything is built.
 *
 * It runs on the map of the area this hustle was actually given, not a stock
 * one — the point of drawing a patch in the wizard is that the work happens
 * there, and this is the first place the app says so back.
 *
 * Once the discovery engine has turned up real businesses they replace the
 * illustrative ones, at their real coordinates. That is why the picture is
 * requested at a centre and zoom worked out here rather than with Mapbox's
 * `/auto/` fit: a pin can only be put in the right place on a map whose
 * projection is known. See src/modules/hustles/static-map.ts.
 *
 * Both outcomes are drawn, not just the hits. A sweep that only ever finds
 * targets says the patch is full of them; the businesses that already have a
 * site, dimmed and passed over, are what make the count underneath mean
 * anything.
 */

/** One full turn of the arm. */
const RADAR_MS = 3600;

/** The frame is 16:9, so a degree across is not a degree down. */
const ASPECT = 16 / 9;

/** The map is requested at this size; the projection is relative to it. */
const MAP = { width: 1024, height: 576 };

/**
 * How many businesses the frame will draw.
 *
 * A swept high street is hundreds of rows, and hundreds of springs animating
 * at once costs more than it shows — past about this many the pins stop being
 * readable as places and become texture.
 */
const MAX_PINS = 36;

interface Place {
  x: number;
  y: number;
  /** Named only when it is a target — the dots are businesses we skip. */
  name?: string;
}

/** Stand-ins, shown only until the sweep has turned up something real. */
const DEMO: Place[] = [
  { x: 38, y: 44, name: "Ravenscroft Dental" },
  { x: 57, y: 35 },
  { x: 47, y: 62, name: "Kellerman Plumbing" },
  { x: 67, y: 55 },
  { x: 31, y: 61, name: "Northline Auto Body" },
  { x: 55, y: 48, name: "Marchetti & Sons" },
  { x: 71, y: 40 },
  { x: 43, y: 31, name: "Halloway Physio" },
];

/** A business the sweep actually found. */
export interface LivePin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** False when they already have a website — drawn, but passed over. */
  target: boolean;
}

/**
 * Clockwise from twelve o'clock, which is where the arm starts.
 *
 * Positions are percentages of a box that is wider than it is tall, so they
 * are scaled back to real proportions first — without that the bearings are
 * wrong everywhere except the diagonals, and pins light while the arm is
 * visibly somewhere else.
 */
const bearingOf = (place: Place) => {
  const dx = (place.x - 50) * ASPECT;
  const dy = place.y - 50;
  return (((Math.atan2(dx, -dy) * 180) / Math.PI) + 360) % 360;
};

/** Each place lights the moment the arm reaches it. */
const sweptOrder = (places: Place[]) =>
  places
    .map((place, index) => ({
      ...place,
      index,
      at: (bearingOf(place) / 360) * (RADAR_MS / 1000),
    }))
    .sort((a, b) => a.at - b.at);

interface Props {
  area: HustleArea;
  theme: "light" | "dark";
  still: boolean;
  /** Bumped by the parent to replay the sweep. */
  cycle: number;
  /** Businesses found so far. Empty until the first ones land. */
  live?: LivePin[];
  /** The running total from the hunt itself, when there is one. */
  found?: number;
}

export const HuntFrame = ({ area, theme, still, cycle, live, found }: Props) => {
  const frame = useMemo(
    () => staticMapFrame(area, { ...MAP, theme }),
    [area, theme],
  );

  // Real businesses the moment there are any; the stand-ins only fill the
  // first few seconds of a sweep, before anything has come back.
  const places = useMemo<Place[]>(() => {
    if (!live || live.length === 0 || frame === null) return DEMO;

    // Targets first, so the cap keeps the businesses worth looking at.
    const ordered = [...live].sort(
      (a, b) => Number(b.target) - Number(a.target),
    );

    return ordered
      .slice(0, MAX_PINS)
      .map((pin) => {
        const { x, y } = frame.project(pin);
        return { x, y, ...(pin.target ? { name: pin.name } : {}) };
      })
      // A business can sit just outside the drawn shape but inside the
      // picture's bounding box, and one pinned off the edge reads as a bug.
      .filter((place) => place.x > 1 && place.x < 99 && place.y > 1 && place.y < 99);
  }, [live, frame]);

  const swept = useMemo(() => sweptOrder(places), [places]);
  const targets = useMemo(() => swept.filter((place) => place.name), [swept]);

  // Ticks up as each one is found rather than landing on the total at the
  // end — the number is the sweep's output, so it arrives with it.
  const [lit, setLit] = useState(still ? targets.length : 0);
  // The one the reticle is currently sat on.
  const [locked, setLocked] = useState<number | null>(null);

  useEffect(() => {
    if (still) {
      setLit(targets.length);
      setLocked(null);
      return;
    }

    setLit(0);
    setLocked(null);

    const timers = targets.flatMap((target, order) => [
      setTimeout(() => {
        setLit(order + 1);
        setLocked(target.index);
      }, target.at * 1000),
      // The lock releases before the next one, so the reticle jumps rather
      // than smearing between two places.
      setTimeout(() => {
        setLocked((current) => (current === target.index ? null : current));
      }, target.at * 1000 + 900),
    ]);

    return () => timers.forEach(clearTimeout);
  }, [cycle, still, targets]);

  // The hunt's own tally wins when there is one: the frame draws at most a
  // few dozen pins, and the readout is counting the patch, not the picture.
  const tally = found ?? lit;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* A slow push in over the sweep, so the frame is never quite static. */}
      <motion.div
        key={still ? "map" : `${cycle}-map`}
        className="absolute inset-0"
        initial={still ? false : { scale: 1.09 }}
        animate={{ scale: 1 }}
        transition={{ duration: RADAR_MS / 1000 + 1, ease: "linear" }}
      >
        {frame && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frame.url}
            alt={`Map of ${area.label}`}
            className="h-full w-full object-cover opacity-40"
          />
        )}
      </motion.div>

      {/* Instrument grid and scan lines — a lens over the map, not a second
          thing drawn on it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-foreground) 1px, transparent 1px), linear-gradient(to bottom, var(--color-foreground) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, var(--color-foreground) 0 1px, transparent 1px 3px)",
        }}
      />

      {/* The arm. Its leading edge sits at the end of the wedge, so at
          rotation R it points at bearing R — which is what lets every pin
          below light exactly as it is passed. */}
      {!still && (
        <motion.div
          key={`${cycle}-radar`}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[155%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, transparent 286deg, color-mix(in oklab, var(--color-foreground) 5%, transparent) 322deg, color-mix(in oklab, var(--color-foreground) 26%, transparent) 358deg, transparent 360deg)",
          }}
          initial={{ rotate: 0, opacity: 0 }}
          animate={{ rotate: 360, opacity: [0, 1, 1, 0] }}
          transition={{
            duration: RADAR_MS / 1000,
            ease: "linear",
            times: [0, 0.06, 0.86, 1],
          }}
        />
      )}

      {swept.map((place) => (
        <motion.div
          key={still ? `p-${place.index}` : `${cycle}-p-${place.index}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${place.x}%`, top: `${place.y}%` }}
          initial={still ? false : { opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            delay: still ? 0 : place.at,
            duration: 0.28,
            ease: place.name ? "backOut" : "easeOut",
          }}
        >
          {place.name ? (
            <>
              {!still && (
                <motion.span
                  key={`${cycle}-ring-${place.index}`}
                  aria-hidden
                  className="border-foreground/45 absolute -inset-2 rounded-full border"
                  initial={{ opacity: 0.75, scale: 0.4 }}
                  animate={{ opacity: 0, scale: 1.8 }}
                  transition={{ delay: place.at, duration: 0.9, ease: "easeOut" }}
                />
              )}
              <MapPinIcon
                weight="fill"
                className="text-foreground size-5 drop-shadow"
              />
            </>
          ) : (
            // Already has a site: seen, and passed over.
            <span className="border-foreground/35 bg-background/40 block size-2.5 rounded-full border" />
          )}
        </motion.div>
      ))}

      {/* The reticle, snapping to whichever target was just turned up. */}
      {!still &&
        swept
          .filter((place) => place.index === locked)
          .map((place) => (
            <motion.div
              key={`${cycle}-lock-${place.index}`}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${place.x}%`, top: `${place.y}%` }}
              initial={{ opacity: 0, scale: 1.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="relative size-12">
                {/* Corner brackets rather than a box: a scope, not a border. */}
                {[
                  "top-0 left-0 border-t border-l",
                  "top-0 right-0 border-t border-r",
                  "bottom-0 left-0 border-b border-l",
                  "bottom-0 right-0 border-b border-r",
                ].map((corner) => (
                  <span
                    key={corner}
                    className={`border-foreground/80 absolute size-3.5 ${corner}`}
                  />
                ))}
              </div>

              <motion.p
                className="bg-background/85 text-foreground absolute top-full left-1/2 mt-1.5 -translate-x-1/2 rounded px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap backdrop-blur"
                initial={{ opacity: 0, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.2 }}
              >
                {place.name}
              </motion.p>
            </motion.div>
          ))}

      {/* Depth. Without it the map is a flat rectangle of grey. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: "inset 0 0 60px 10px color-mix(in oklab, black 45%, transparent)",
        }}
      />

      {/* The readout, bottom edge. */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
        <p className="bg-background/70 text-muted-foreground truncate rounded-full px-2.5 py-1 font-mono text-[10px] backdrop-blur">
          {area.label}
        </p>

        <p className="bg-background/70 shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] tabular-nums backdrop-blur">
          <motion.span
            key={`${cycle}-${tally}`}
            className="text-foreground inline-block"
            initial={still ? false : { scale: 1.6, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {tally}
          </motion.span>
          <span className="text-muted-foreground"> with no site</span>
        </p>
      </div>
    </div>
  );
};
