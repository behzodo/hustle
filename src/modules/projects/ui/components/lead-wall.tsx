"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  ArrowSquareOutIcon,
  CrosshairIcon,
  PhoneIcon,
  StarIcon,
  WarningIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { ProjectId } from "@/modules/projects/types";
import {
  describeEmptySweep,
  describeGap,
  type WebPresence,
} from "@/modules/hustles/discovery/lead";
import { useHunt, useLeads } from "@/modules/hustles/use-discovery";

/**
 * What the sweep came back with, dropped into place, cut down, and filed.
 *
 * The screen runs one sequence and then hands the canvas back. It is a
 * sequence rather than a list because each beat answers the question the
 * previous one raises:
 *
 *  1. LAND    — everything found falls in, best first. The full haul, because
 *               that is what the sweep was paid to produce and opening on a
 *               trimmed version of it would be the screen deciding on its own
 *               that the rest never existed.
 *  2. CUT     — the bar is drawn across the wall, what sits under it is marked,
 *               and it falls away. So the shortlist reads as the result of a
 *               cut rather than a list that arrived pre-cut. Nothing is
 *               destroyed; what went is one labelled click away.
 *  3. FILE    — the shortlist flies into "Building" in the rail, one after
 *               another, and the canvas empties. The point is not the flourish:
 *               it is that the businesses end up somewhere the user can see on
 *               screen, so the next question — "where did my leads go" — is
 *               answered before it is asked.
 *  4. HAND OFF— `onFiled` fires and the canvas goes back to the explainer, on
 *               the build act. See blank-canvas.tsx.
 *
 * Anyone who touches the wall keeps it. Clicking to see what the cut took is
 * someone reading their leads, and flying the wall out from under a person
 * mid-sentence would be the animation deciding it mattered more than they did.
 */

/** Enough to fill any screen; past this the wall is scrolling anyway. */
const WALL_LIMIT = 120;

/**
 * How long the whole cascade takes, however many tiles there are.
 *
 * Per-tile delay alone reads well for twenty and takes six seconds for a
 * hundred, by which point it is a loading screen rather than an entrance.
 */
const CASCADE_MS = 1500;

/**
 * The score a business has to clear to stay on the wall.
 *
 * Not a round number picked because it sounds decisive — see scoreLead(). A
 * ninety is exactly: no website at all (55), enough reviews to prove it trades
 * (20), four stars or better (10), and a phone to ring (5). Every one of those
 * is a reason the first pitch of the day should go there. What clears the bar
 * is worth an hour; what sits under it is worth a look, which is a different
 * job on a different afternoon.
 */
const PITCH_BAR = 90;

/**
 * The cut only runs if this many survive it.
 *
 * A patch of Facebook-only shops tops out at 85 — a real gap, a real lead, and
 * under the bar every time. Cutting there would sweep the wall to nothing and
 * tell someone their town was empty seconds after handing them forty
 * businesses. When the bar cannot separate the list there is nothing to
 * triage, so the wall stays whole and no bar is ever drawn.
 */
const MIN_KEPT = 6;

/** The wall lands, then holds still for a beat before the bar is drawn. */
const MARK_AT_MS = 1700;

/** Long enough to read what is about to go before it goes. */
const CUT_AT_MS = 2400;

/** The shortlist stands on its own for a moment before it is filed. */
const FILE_AT_MS = 3600;

/** No cut to watch, so the wall is filed sooner. */
const FILE_AT_NO_CUT_MS = 2600;

/** One tile's trip to the rail. */
const FLIGHT_MS = 620;

/** The gap between departures — what makes it a queue rather than a burst. */
const FLIGHT_STEP_MS = 55;

/** Whole-cohort budget. Thirty tiles leaving at their own pace is a wait. */
const FLIGHT_WINDOW_MS = 1900;

/** How long the shortlist stands when there is no animation to watch. */
const STILL_HOLD_MS = 4000;

type WallLead = {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  presence: WebPresence;
  socialKind?: string;
  rating?: number;
  reviewCount?: number;
  categories: string[];
  score: number;
};

/**
 * One tile's trip, in viewport coordinates.
 *
 * The tile is pinned where it already sat and then translated, rather than
 * being animated inside the grid: the rail is outside the scrolling canvas, so
 * a tile flying there in flow is clipped at the canvas edge and vanishes a
 * hundred pixels short of the icon it was aimed at.
 */
type Flight = {
  top: number;
  left: number;
  width: number;
  height: number;
  dx: number;
  dy: number;
  delay: number;
};

type Filing = {
  /** Centre of the icon everything is flying into. */
  target: { x: number; y: number };
  /** Held so the canvas does not collapse as the tiles leave the flow. */
  gridHeight: number;
  flights: { lead: WallLead; flight: Flight }[];
};

/**
 * The headline number, running itself down as the wall is cut.
 *
 * A number that swaps straight from 72 to 31 reads as a different screen. One
 * that counts down while the tiles fall reads as this screen losing them,
 * which is what happened.
 */
const CountingFigure = ({ value, still }: { value: number; still: boolean }) => {
  const count = useMotionValue(value);
  const shown = useTransform(count, (live) => Math.round(live).toString());

  useEffect(() => {
    if (still) {
      count.set(value);
      return;
    }

    const controls = animate(count, value, {
      duration: 0.55,
      ease: [0.4, 0, 0.2, 1],
    });

    return () => controls.stop();
  }, [value, still, count]);

  return (
    <motion.span className="headline-figure text-primary tabular-nums">
      {shown}
    </motion.span>
  );
};

/**
 * The bar itself, ruled across the full width of the grid at the split.
 *
 * Rendered as a grid child rather than drawn over the wall, so the tiles under
 * it are genuinely pushed below it and the threshold is a thing on the page
 * instead of a rule applied somewhere off it.
 */
const CutBar = ({
  dropped,
  falling,
  still,
}: {
  dropped: number;
  /** The cut is happening now, rather than the bar being shown after one. */
  falling: boolean;
  still: boolean;
}) => (
  <motion.div
    layout
    className="col-span-full flex items-center gap-3 pt-2 pb-1"
    initial={still ? false : { opacity: 0, scaleX: 0.94 }}
    animate={{ opacity: 1, scaleX: 1 }}
    exit={{ opacity: 0, transition: { duration: 0.25 } }}
    transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
  >
    <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
      the bar · {PITCH_BAR}
    </span>
    <span className="bg-border h-px flex-1" />
    <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
      {dropped} {falling ? "dropping" : "below"}
    </span>
  </motion.div>
);

const Tile = ({
  lead,
  delay,
  still,
  doomed,
  settled,
  exitOrder,
  fromBelow,
  flight,
  onNode,
}: {
  lead: WallLead;
  delay: number;
  still: boolean;
  /** Under the bar, and marked as such for the moment before it goes. */
  doomed: boolean;
  /** The cascade is over, so the tile can take part in layout animations. */
  settled: boolean;
  /** Position within the doomed set, so the fall sweeps rather than pops. */
  exitOrder: number;
  /** Coming back after a cut — it returns from where it went. */
  fromBelow: boolean;
  /** Set only while this tile is on its way to the rail. */
  flight?: Flight;
  onNode?: (id: string, node: HTMLElement | null) => void;
}) => (
  <motion.article
    ref={(node) => onNode?.(lead._id, node)}
    // A layout animation would fight the flight for the same transform.
    layout={flight ? false : settled}
    className={cn(
      "bg-card relative flex flex-col gap-2 rounded-xl border p-4",
      // The ones with nothing at all are the cleanest pitch, so they carry
      // the heavier edge. Everything else on this screen is the same weight.
      lead.presence === "none" ? "border-foreground/25" : "border-border",
    )}
    style={
      flight
        ? {
            position: "fixed",
            top: flight.top,
            left: flight.left,
            width: flight.width,
            height: flight.height,
            margin: 0,
            zIndex: 60,
          }
        : undefined
    }
    initial={
      flight
        ? // Pinned exactly where it already was, so the hand-over from the grid
          // to the flight is a frame nobody can see.
          { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0, filter: "blur(0px)" }
        : still
          ? false
          : fromBelow
            ? { y: 70, opacity: 0, scale: 0.94, filter: "blur(6px)", rotate: 0 }
            : {
                y: -140,
                opacity: 0,
                filter: "blur(0px)",
                rotate: delay % 0.2 > 0.1 ? -2.5 : 2.5,
              }
    }
    animate={
      flight
        ? {
            x: flight.dx,
            y: flight.dy,
            // Not to nothing: a tile that reaches zero has been deleted, one
            // that reaches the size of the icon has been put in it.
            scale: 0.04,
            opacity: 0,
            rotate: 0,
            filter: "blur(2px)",
          }
        : {
            y: 0,
            rotate: 0,
            // Marked, not yet gone. The split is legible for a moment before
            // the wall acts on it, so the cut is something watched rather than
            // noticed afterwards.
            opacity: doomed ? 0.28 : 1,
            scale: doomed ? 0.97 : 1,
            filter: doomed ? "blur(1px)" : "blur(0px)",
          }
    }
    exit={
      still
        ? { opacity: 0, transition: { duration: 0.2 } }
        : {
            // Down and away, accelerating — the mirror of the drop that put it
            // there. Discarded, without needing a bin drawn on the screen to
            // say so.
            y: 90,
            opacity: 0,
            scale: 0.9,
            filter: "blur(8px)",
            rotate: exitOrder % 2 === 0 ? 2.5 : -2.5,
            transition: {
              duration: 0.42,
              ease: [0.4, 0, 1, 1],
              // Capped: a hundred tiles leaving in strict order is a queue,
              // not a sweep.
              delay: Math.min(Math.max(exitOrder, 0), 14) * 0.028,
            },
          }
    }
    transition={
      flight
        ? {
            duration: FLIGHT_MS / 1000,
            delay: flight.delay,
            ease: [0.4, 0, 0.2, 1],
            // The two axes are eased differently on purpose. Matched, the tile
            // slides along a straight diagonal like a dragged window; split,
            // it leaves flat and drops in at the end, which is the shape of
            // something being thrown rather than moved.
            x: {
              duration: FLIGHT_MS / 1000,
              delay: flight.delay,
              ease: [0.55, 0, 0.3, 1],
            },
            y: {
              duration: FLIGHT_MS / 1000,
              delay: flight.delay,
              ease: [0.2, 0.5, 0.35, 1],
            },
            // Held visible for most of the trip: a tile that fades immediately
            // never arrives anywhere, it just stops existing near the start.
            opacity: {
              duration: FLIGHT_MS / 1000,
              delay: flight.delay,
              times: [0, 0.72, 1],
            },
          }
        : still
          ? undefined
          : doomed || settled
            ? { duration: 0.45, ease: [0.4, 0, 0.2, 1] }
            : // A spring rather than an ease, because the overshoot is the
              // point: a tile that stops dead has been placed, one that settles
              // has landed.
              { type: "spring", stiffness: 340, damping: 22, mass: 0.8, delay }
    }
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-medium">{lead.name}</h3>
        <p className="text-muted-foreground truncate text-xs">
          {lead.categories[0] ?? lead.address ?? "—"}
        </p>
      </div>

      {/* The score, small and in the corner — the ordering already says it
          louder than a number can. Struck through at the moment it is the
          thing disqualifying the business, so nothing leaves unexplained. */}
      <span
        className={cn(
          "text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums",
          doomed && "line-through",
        )}
      >
        {lead.score}
      </span>
    </div>

    <p
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]",
        lead.presence === "none"
          ? "bg-foreground text-background"
          : "bg-foreground/8 text-foreground",
      )}
    >
      {describeGap(lead.presence, lead.socialKind)}
      {lead.website && (
        <a
          href={lead.website}
          target="_blank"
          rel="noreferrer noopener"
          className="opacity-60 transition-opacity hover:opacity-100"
          aria-label={`Open the page ${lead.name} uses instead`}
        >
          <ArrowSquareOutIcon className="size-3" />
        </a>
      )}
    </p>

    <div className="text-muted-foreground mt-auto flex items-center gap-3 pt-1 text-[11px]">
      {lead.reviewCount !== undefined && (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <StarIcon className="text-foreground/50 size-3" weight="fill" />
          {lead.rating?.toFixed(1) ?? "—"}
          <span className="opacity-60">({lead.reviewCount})</span>
        </span>
      )}
      {lead.phone && (
        <span className="inline-flex items-center gap-1">
          <PhoneIcon className="size-3" />
          {lead.phone}
        </span>
      )}
    </div>
  </motion.article>
);

export const LeadWall = ({
  projectId,
  areaLabel,
  fileRef,
  onFiled,
}: {
  projectId: ProjectId;
  areaLabel?: string;
  /**
   * The rail icon the shortlist is filed into. Without one the wall skips the
   * flight and hands straight over — see the mobile note in `startFiling`.
   */
  fileRef?: RefObject<HTMLElement | null>;
  /** Fired once the last tile has landed and the canvas is clear. */
  onFiled?: () => void;
}) => {
  const still = Boolean(useReducedMotion());
  const hunt = useHunt(projectId);
  const leads = useLeads(projectId, { limit: WALL_LIMIT });

  // Everything up to the loading return has to be a hook or derived from one,
  // because a hook cannot sit behind an early return.
  const list = useMemo<WallLead[]>(() => leads ?? [], [leads]);

  // The query returns them by score, descending, so the ones under the bar are
  // always the tail — a count is enough to find the split.
  const keptCount = useMemo(
    () => list.filter((lead) => lead.score >= PITCH_BAR).length,
    [list],
  );

  const dropped = list.length - keptCount;
  const canCut = dropped > 0 && keptCount >= MIN_KEPT;

  const [phase, setPhase] = useState<
    "landing" | "marking" | "cut" | "filing" | "filed"
  >("landing");
  const [showAll, setShowAll] = useState(false);
  const [held, setHeld] = useState(false);
  const [filing, setFiling] = useState<Filing | null>(null);

  // The parent's callback can be a fresh function every render; the sequence
  // must not restart because of that.
  const finished = useRef(onFiled);
  useEffect(() => {
    finished.current = onFiled;
  });

  // What is on screen right now, for the measuring pass — which runs from a
  // timer and so cannot read this render's variables.
  const onScreen = useRef<WallLead[]>([]);
  const nodes = useRef(new Map<string, HTMLElement>());

  const registerNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * Measure everything, then send it.
   *
   * Measuring and switching in one go rather than in an effect after the
   * switch: a frame rendered between the two would be a wall of tiles pinned
   * at their old positions with nowhere to go yet, which is a visible stutter
   * at the exact moment the screen is asking to be watched.
   */
  const startFiling = useCallback(() => {
    const icon = fileRef?.current?.getBoundingClientRect();
    const grid = gridRef.current?.getBoundingClientRect();

    // No rail to fly into: the icon is display:none under `md`, where the
    // navigation is a top bar instead, and a rect of zeros would send every
    // tile to the top-left corner of the screen. Hand over without the flight
    // rather than performing a wrong one.
    const flyable =
      !still && icon !== undefined && icon.width > 0 && grid !== undefined;

    if (!flyable) {
      setPhase("filed");
      finished.current?.();
      return;
    }

    const target = { x: icon.left + icon.width / 2, y: icon.top + icon.height / 2 };

    const leaving = onScreen.current
      .map((lead) => ({ lead, node: nodes.current.get(lead._id) }))
      .filter((entry): entry is { lead: WallLead; node: HTMLElement } =>
        entry.node !== undefined,
      );

    const step = Math.min(
      FLIGHT_STEP_MS,
      FLIGHT_WINDOW_MS / Math.max(leaving.length, 1),
    );

    const flights = leaving.map(({ lead, node }, index) => {
      const rect = node.getBoundingClientRect();

      return {
        lead,
        flight: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          dx: target.x - (rect.left + rect.width / 2),
          dy: target.y - (rect.top + rect.height / 2),
          delay: (index * step) / 1000,
        },
      };
    });

    setFiling({ target, gridHeight: grid.height, flights });
    setPhase("filing");
  }, [fileRef, still]);

  // The whole sequence, as one set of timers so that anything cancelling it
  // cancels all of it.
  useEffect(() => {
    if (leads === undefined || list.length === 0) return;

    // Somebody is reading. The wall is theirs now.
    if (held) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    if (still) {
      if (canCut) setPhase("cut");
      // Asking for less motion is not asking to be hurried: there is no
      // choreography to sit through here, so the shortlist gets the time the
      // animated version spends earning it.
      timers.push(setTimeout(startFiling, STILL_HOLD_MS));
    } else if (canCut) {
      timers.push(setTimeout(() => setPhase("marking"), MARK_AT_MS));
      timers.push(setTimeout(() => setPhase("cut"), CUT_AT_MS));
      timers.push(setTimeout(startFiling, FILE_AT_MS));
    } else {
      timers.push(setTimeout(startFiling, FILE_AT_NO_CUT_MS));
    }

    return () => timers.forEach(clearTimeout);
  }, [leads, list.length, canCut, still, held, startFiling]);

  // The last tile lands, the canvas is empty, and the explainer takes it back.
  useEffect(() => {
    if (filing === null) return;

    const last = filing.flights.at(-1)?.flight.delay ?? 0;
    const timer = setTimeout(
      () => {
        setPhase("filed");
        finished.current?.();
      },
      last * 1000 + FLIGHT_MS + 120,
    );

    return () => clearTimeout(timer);
  }, [filing]);

  if (leads === undefined) return null;

  const afterCut = canCut && (phase === "cut" || phase === "filing");
  const shortlisted = afterCut && !showAll;
  const settled = phase !== "landing";
  const flying = phase === "filing" || phase === "filed";

  // Emptied rather than filtered: during the flight every tile is pinned to
  // the viewport and rendered outside this tree, so the grid holds space and
  // nothing else.
  const visible = flying
    ? []
    : shortlisted
      ? list.slice(0, keptCount)
      : list;

  onScreen.current = visible;

  // Drawn while the cut is being made, and again whenever someone asks to see
  // what it took. In both cases it is the only thing on screen saying where
  // the line falls and why the wall breaks there.
  const showBar = canCut && (phase === "marking" || (afterCut && showAll));

  const step = list.length > 0 ? CASCADE_MS / list.length / 1000 : 0;

  const figure = shortlisted ? keptCount : (hunt?.found ?? list.length);
  const label = shortlisted
    ? "worth pitching first"
    : // OpenStreetMap cannot tell us a business has no website, only that
      // nobody wrote one down. When the sweep fell through to it, the headline
      // says what was actually established.
      hunt?.provider === "osm"
      ? "worth checking"
      : "with no website";

  // Built as one list so the bar can sit *between* the tiles it separates
  // rather than after all of them.
  const wall: ReactNode[] = [];

  visible.forEach((lead, index) => {
    const under = index >= keptCount;

    if (showBar && index === keptCount) {
      wall.push(
        <CutBar
          key="bar"
          dropped={dropped}
          falling={phase === "marking"}
          still={still}
        />,
      );
    }

    wall.push(
      <Tile
        key={lead._id}
        lead={lead}
        delay={index * step}
        still={still}
        doomed={phase === "marking" && under}
        settled={settled}
        exitOrder={index - keptCount}
        fromBelow={afterCut && under}
        onNode={registerNode}
      />,
    );
  });

  return (
    <div className="mx-auto w-full max-w-7xl">
      <motion.div
        className="mb-6"
        // The heading goes with the wall it counts, a beat after the last tile
        // has left rather than with the first.
        animate={{ opacity: phase === "filing" || phase === "filed" ? 0 : 1 }}
        transition={{ duration: 0.4, delay: phase === "filing" ? 0.9 : 0 }}
      >
        {/* One line, not a header block. The wall is the content. */}
        <motion.div
          className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
          initial={still ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="headline-display font-display text-2xl leading-none tracking-[-0.03em] md:text-3xl">
            <CountingFigure value={figure} still={still} />{" "}
            <motion.span
              key={label}
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35 }}
            >
              {label}
            </motion.span>
          </h1>

          <p className="text-muted-foreground font-mono text-xs">
            {areaLabel}
            {hunt && hunt.scanned > 0 && (
              <>
                {" · "}
                {hunt.scanned} businesses swept
              </>
            )}
          </p>
        </motion.div>

        {/* The way back to what the cut took. It appears only once something
            has been cut, and it names the number rather than saying "show
            more" — how much is hidden is the reason to look at it. Using it
            also stops the wall being filed: someone reading their leads is not
            someone waiting for the next scene. */}
        {phase === "cut" && (
          <motion.button
            type="button"
            onClick={() => {
              setHeld(true);
              setShowAll((open) => !open);
            }}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-2 rounded-sm font-mono text-xs underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: still ? 0 : 0.35 }}
          >
            {showAll
              ? `Hide the ${dropped} below the bar`
              : `Show the ${dropped} below the bar`}
          </motion.button>
        )}
      </motion.div>

      {hunt?.status === "failed" && phase !== "filing" && phase !== "filed" && (
        <div className="border-destructive/40 bg-destructive/5 mb-6 flex items-start gap-3 rounded-xl border p-3">
          <WarningIcon className="text-destructive mt-0.5 size-4 shrink-0" weight="fill" />
          <p className="text-muted-foreground text-xs">
            The sweep stopped early — {hunt.error} Everything it found before
            that is below.
          </p>
        </div>
      )}

      {list.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 py-24 text-center">
          <CrosshairIcon className="size-8 opacity-40" />
          <p className="max-w-lg text-sm text-balance">
            {describeEmptySweep(hunt ?? null)}
          </p>
        </div>
      ) : (
        <div
          ref={gridRef}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          // Held at the height it had, so the page does not jump out from
          // under the tiles the moment they leave the flow — and still held
          // through the hand-over, or the canvas collapses under the fade.
          style={flying ? { height: filing?.gridHeight } : undefined}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {wall}
          </AnimatePresence>
        </div>
      )}

      {/* The flight. Portalled to the body because the canvas it started in
          scrolls, and a scrolling box clips its own children — a tile aimed at
          the rail would otherwise be cut off at the edge of the canvas, a
          hundred pixels short of the icon it was thrown at. */}
      {phase === "filing" &&
        filing !== null &&
        createPortal(
          <>
            {filing.flights.map(({ lead, flight }) => (
              <Tile
                key={lead._id}
                lead={lead}
                delay={0}
                still={still}
                doomed={false}
                settled={false}
                exitOrder={0}
                fromBelow={false}
                flight={flight}
              />
            ))}

            {/* Something receiving them. Without it the tiles converge on a
                point that gives no sign of having taken anything, and the
                whole flight reads as thirty things falling down a hole. */}
            <motion.span
              aria-hidden
              className="border-foreground/40 pointer-events-none fixed z-50 size-9 rounded-full border"
              style={{
                left: filing.target.x,
                top: filing.target.y,
                marginLeft: -18,
                marginTop: -18,
              }}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.5], opacity: [0.55, 0] }}
              transition={{
                duration: 0.85,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          </>,
          document.body,
        )}
    </div>
  );
};
