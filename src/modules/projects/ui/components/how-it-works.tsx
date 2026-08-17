"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  HammerIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  type Icon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { api } from "@/../convex/_generated/api";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { DiaTextReveal } from "@/components/ui/dia-text-reveal";
import { useCurrentTheme } from "@/hooks/use-current-theme";
import type { ProjectId } from "@/modules/projects/types";
import { useProject } from "@/modules/projects/use-projects";
import { useHunt, usePins } from "@/modules/hustles/use-discovery";

import { HuntFrame, type LivePin } from "./hunt-frame";
import { PitchFrame, figureForBand } from "./pitch-frame";

/**
 * What happens once you name a business, shown rather than listed.
 *
 * One instrument frame runs the two halves of the job in order: the patch is
 * swept for businesses with no site, then a site is built for one of them.
 * A row of three icons would describe the same process, but every explainer
 * is a row of three icons, and none of them are the work itself.
 *
 * The frame is the app's own brushed neutral — `.metal-bezel` in globals.css,
 * the same stop list `.metal-plate` is mixed from, which in turn is the metal
 * the logo mark is painted in. No hue anywhere.
 */

// The beams are an SVG gradient, so they take real stops rather than an
// `oklch()` var — both ends of the same ramp the plate is mixed from.
const BEAM = {
  light: { start: "#2c2e31", stop: "#a2a4aa", path: "#35373a" },
  dark: { start: "#f4f5f7", stop: "#72747a", path: "#c4c6cc" },
} as const;

// The headline is lit by the same metal the frame is pressed from, so the
// light crossing it belongs to the object underneath rather than being a
// gradient for its own sake.
const SHEEN = {
  light: ["#8f9197", "#2c2e31", "#0a0a0a", "#4e5054"],
  dark: ["#8a8c92", "#f4f5f7", "#ffffff", "#b9bbc1"],
} as const;

/** Long enough for the radar to go round and every pin to land. */
const HUNT_MS = 4600;

/** Type the address, then lay the page out. */
const BUILD_MS = 5400;

/** Send it, then stamp the answer on. */
const PITCH_MS = 4400;

// Businesses of the kind this is pointed at, so the window is never showing
// lorem ipsum for a product whose whole pitch is that the work is real.
const SITES = [
  "ravenscroft-dental.com",
  "kellermanplumbing.com",
  "northlineautobody.com",
] as const;

/**
 * One pass of the agent, as both halves of what it does.
 *
 * `code` is the line it writes; `block` is the piece of page that line puts
 * on screen. They are the same event, so they are one list — the preview
 * cannot drift out of step with the source that produced it.
 */
const SCRIPT: { at: number; code: string; block?: number }[] = [
  { at: 0.35, code: "export default function Page() {" },
  { at: 0.6, code: "  return (" },
  { at: 0.85, code: '    <Header logo="Kellerman" />', block: 0 },
  { at: 1.25, code: '    <Hero headline="24/7 emergency" />', block: 1 },
  { at: 1.7, code: "    <Services items={SERVICES} />", block: 2 },
  { at: 2.15, code: '    <Contact phone="(507) 934‑2210" />', block: 3 },
  { at: 2.5, code: "  )" },
  { at: 2.7, code: "}" },
];

/** Only the payoff phrase is swept — see the heading below. */
const PAYOFF = "already done";

/**
 * The heading, swept in once and then left alone.
 *
 * DiaTextReveal paints every character ahead of its sweep band transparent,
 * so a sweep that does not finish leaves the heading invisible rather than
 * unanimated. Two things happen in dev to cause exactly that: React's strict
 * mode runs the effect, tears it down mid-animation, then hits the component's
 * own `once` guard and never replays.
 *
 * So the reveal is treated as an entrance with a deadline. Once the sweep has
 * had its time, the text is swapped for a plain span that owes nothing to any
 * animation still running or not running underneath.
 */
const Headline = ({ colors }: { colors: string[] }) => {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 2400);
    return () => clearTimeout(timer);
  }, []);

  if (settled) return <span>{PAYOFF}</span>;

  return (
    <DiaTextReveal
      text={PAYOFF}
      colors={colors}
      textColor="var(--color-foreground)"
      duration={1.8}
      delay={0.2}
      startOnView={false}
      once={false}
    />
  );
};

type Phase = "hunt" | "build" | "pitch";

const DURATION: Record<Phase, number> = {
  hunt: HUNT_MS,
  build: BUILD_MS,
  pitch: PITCH_MS,
};

/** The rendered piece each scripted line puts on the page. */
const BLOCKS = [
  { className: "h-[6%] w-[26%] rounded-md" },
  { className: "h-[15%] w-[72%] rounded-lg" },
  { className: "h-[9%] w-[52%] rounded-md" },
] as const;

/**
 * The files scrolling past the status line.
 *
 * Real paths from the template the sandbox builds in, not invented ones — the
 * agent's `createOrUpdateFiles` tool writes exactly these.
 */
const WRITES = [
  { at: 0.45, text: "app/layout.tsx" },
  { at: 0.9, text: "components/header.tsx" },
  { at: 1.35, text: "components/hero.tsx" },
  { at: 1.8, text: "components/services.tsx" },
  { at: 2.25, text: "components/contact.tsx" },
] as const;

/** The page being written, and the source writing it. */
const BuildPage = ({ still, cycle }: { still: boolean; cycle: number }) => (
  <div className="relative flex h-full flex-col">
    <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[1.05fr_1fr]">
      {/* Source. What the agent is actually doing. */}
      <div className="border-border/50 relative hidden min-h-0 overflow-hidden border-r p-[4%] sm:block">
        <div className="space-y-[1.5%] font-mono text-[11px] leading-relaxed">
          {SCRIPT.map((line, index) => (
            <motion.div
              key={still ? `l-${index}` : `${cycle}-l-${index}`}
              className="flex gap-3 whitespace-pre"
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: still ? 0 : line.at, duration: 0.15 }}
            >
              <span className="text-muted-foreground/40 w-3 shrink-0 text-right tabular-nums">
                {index + 1}
              </span>

              {/* Revealed by width, so each line is typed rather than
                  faded in whole. */}
              <motion.span
                className="text-foreground/70 overflow-hidden"
                initial={still ? false : { width: 0 }}
                animate={{ width: "auto" }}
                transition={{
                  delay: still ? 0 : line.at,
                  duration: 0.22,
                  ease: "linear",
                }}
              >
                {line.code}
              </motion.span>
            </motion.div>
          ))}
        </div>

        {/* The caret, sat where the next line will land. */}
        {!still && (
          <motion.span
            key={`${cycle}-caret`}
            className="bg-foreground/70 absolute left-[4%] block h-3 w-[6px]"
            initial={{ opacity: 0, top: "4%" }}
            animate={{
              opacity: [0, 1, 1, 0],
              top: ["6%", "12%", "78%", "84%"],
            }}
            transition={{ duration: 3, times: [0, 0.08, 0.9, 1], ease: "linear" }}
          />
        )}
      </div>

      {/* Preview. What that source puts on screen. */}
      <div className="relative min-h-0 p-[6%]">
        <div className="flex h-full flex-col gap-[3%]">
          {BLOCKS.map((block, index) => {
            const line = SCRIPT.find((entry) => entry.block === index);

            return (
              <motion.div
                key={still ? `b-${index}` : `${cycle}-b-${index}`}
                className={cn("bg-foreground/12", block.className)}
                initial={still ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: still ? 0 : (line?.at ?? 0) + 0.1,
                  duration: 0.3,
                }}
              />
            );
          })}

          <div className="mt-auto grid grid-cols-3 gap-[4%]">
            {[0, 1, 2].map((card) => (
              <motion.div
                key={still ? `c-${card}` : `${cycle}-c-${card}`}
                className="bg-foreground/8 ring-foreground/10 h-[70%] rounded-lg ring-1"
                initial={still ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: still ? 0 : 2.25 + card * 0.09,
                  duration: 0.3,
                }}
              />
            ))}
          </div>
        </div>

        {/* The pass the agent makes over the page as it writes it. */}
        {!still && (
          <motion.div
            key={`${cycle}-scan`}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-20"
            style={{
              background:
                "linear-gradient(180deg, transparent, color-mix(in oklab, var(--color-foreground) 8%, transparent), transparent)",
            }}
            initial={{ y: "-100%", opacity: 0 }}
            animate={{ y: "520%", opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.4, delay: 0.35, ease: "easeInOut" }}
          />
        )}
      </div>
    </div>

    {/* What the agent is doing, in the words it would use. One line that
        replaces itself rather than a list that grows. */}
    <div className="border-border/50 text-muted-foreground relative flex h-7 shrink-0 items-center gap-1.5 border-t px-[2%] font-mono text-[10px]">
      <span className="bg-foreground/50 size-1 shrink-0 rounded-full" />

      {still ? (
        <span>{WRITES.length} files written</span>
      ) : (
        <>
          {WRITES.map((write, index) => (
            <motion.span
              key={`${cycle}-w-${index}`}
              className="absolute left-[2%] ml-3.5 truncate"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: [0, 1, 1, 0], y: [4, 0, 0, -4] }}
              transition={{
                delay: write.at,
                duration: 0.55,
                times: [0, 0.2, 0.75, 1],
              }}
            >
              writing {write.text}
            </motion.span>
          ))}

          <motion.span
            key={`${cycle}-done`}
            className="absolute left-[2%] ml-3.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.9, duration: 0.3 }}
          >
            ready — {WRITES.length} files, 0 errors
          </motion.span>
        </>
      )}
    </div>
  </div>
);

interface Stage {
  key: "discover" | "build" | "pitch";
  icon: Icon;
  label: string;
  /** Marked when the step is not wired up yet, so the picture stays honest. */
  soon?: boolean;
}

const STAGES: Stage[] = [
  // No longer marked `soon`: the sweep below is the real one, running against
  // the patch this hustle was drawn on.
  { key: "discover", icon: MagnifyingGlassIcon, label: "Discover" },
  { key: "build", icon: HammerIcon, label: "Build" },
  { key: "pitch", icon: PaperPlaneTiltIcon, label: "Pitch", soon: true },
];

export const HowItWorks = ({
  projectId,
  className,
}: {
  projectId: ProjectId;
  className?: string;
}) => {
  const theme = useCurrentTheme();
  const still = Boolean(useReducedMotion());

  const project = useProject(projectId);
  const area = project?.area ?? null;

  const profile = useQuery(api.profiles.status);
  const figure = figureForBand(profile?.priceBand);

  // The real sweep this frame is drawing. Both are live subscriptions, so
  // pins land in the frame as the server writes them.
  const hunt = useHunt(projectId);
  const pins = usePins(projectId);
  const sweeping = hunt?.status === "running";

  const live = useMemo<LivePin[]>(
    () =>
      (pins ?? []).map((pin) => ({
        id: pin._id,
        name: pin.name,
        lat: pin.lat,
        lng: pin.lng,
        target: pin.presence !== "site",
      })),
    [pins],
  );

  const [phase, setPhase] = useState<Phase>("hunt");
  const [cycle, setCycle] = useState(0);

  // A project made before the wizard existed has no patch to sweep, so its
  // loop starts at the build instead.
  const act: Phase =
    sweeping && area !== null
      ? "hunt"
      : phase === "hunt" && area === null
        ? "build"
        : phase;

  useEffect(() => {
    if (still) return;

    const timer = setTimeout(() => {
      // While the sweep is actually running the frame stays on it and replays.
      // The other two acts are steps that have not happened yet, and cutting
      // away from the work in progress to mime the next one is the explainer
      // talking over the thing it was explaining.
      if (sweeping && area !== null) return setCycle((n) => n + 1);

      if (act === "hunt") return setPhase("build");
      if (act === "build") return setPhase("pitch");

      // Bumping the cycle is what restarts the sequence — without it the
      // effect would not re-run when the phase it lands back on is the one
      // it already holds.
      setCycle((n) => n + 1);
      setPhase("hunt");
    }, DURATION[act]);

    return () => clearTimeout(timer);
  }, [act, cycle, still, sweeping, area]);

  /**
   * Replay the sweep the moment a batch of real businesses lands.
   *
   * Without this the frame keeps turning on its own four-and-a-half second
   * clock while the pins underneath change out from under it, and the arm
   * passes places it already swept. Restarting on arrival is what actually
   * ties the animation to the work: every turn of the radar is a turn that
   * found something.
   */
  const pinCount = live.length;
  const lastCount = useRef(pinCount);

  useEffect(() => {
    if (!sweeping || pinCount === lastCount.current) return;

    lastCount.current = pinCount;
    setCycle((n) => n + 1);
  }, [pinCount, sweeping]);

  const containerRef = useRef<HTMLDivElement>(null);
  const discoverRef = useRef<HTMLDivElement>(null);
  const buildRef = useRef<HTMLDivElement>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

  const refs = [discoverRef, buildRef, pitchRef];
  const colors = theme === "dark" ? BEAM.dark : BEAM.light;
  const activeStage: Stage["key"] =
    act === "hunt" ? "discover" : act === "build" ? "build" : "pitch";

  // The same address across the build and the pitch, so the site that gets
  // sent is visibly the one that was just written.
  const site = SITES[cycle % SITES.length];

  const beam = {
    pathColor: colors.path,
    pathOpacity: 0.2,
    pathWidth: 1.5,
    gradientStartColor: colors.start,
    gradientStopColor: colors.stop,
    duration: 3.5,
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* Something for the metal to stand on: a lit object on a flat black
          field floats, a soft pool under it makes the field a surface. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[30rem] -translate-y-1/2"
        style={{
          // color-mix rather than a slash alpha: `var(--x)/8%` is only legal
          // inside a colour function, and written here it kills the whole
          // gradient without a word.
          background:
            "radial-gradient(48% 50% at 50% 50%, color-mix(in oklab, var(--color-foreground) 10%, transparent), transparent 72%)",
        }}
      />

      <div className="mx-auto mb-8 max-w-2xl text-center">
        <p className="eyebrow text-muted-foreground font-medium">
          Behind the scenes
        </p>
        {/* The app's own pattern, which nothing on this screen was using:
            globals.css sets `.headline-figure` aside for "the accented payoff
            phrase", heavier than the words around it, because the thing being
            promised should outweigh the setup. Here the setup is turning up;
            the promise is that the work is already done.

            The chrome crosses only that phrase. Sweeping the whole line
            fought the two weights, and the half worth looking at is the half
            worth lighting. */}
        <h2 className="headline-display font-display mt-5 text-4xl leading-[1.0] tracking-[-0.035em] text-balance sm:text-[3.4rem]">
          Turn up with the work{" "}
          <span className="headline-figure text-primary">
            <Headline
              colors={[...(theme === "dark" ? SHEEN.dark : SHEEN.light)]}
            />
          </span>
        </h2>
      </div>

      <motion.div
        // Width comes off the viewport height so the 16:9 frame grows to fill
        // the canvas without ever pushing the caption off the bottom: whatever
        // is left after the heading, the steps and the standfirst, turned back
        // into a width. Capped so it stops being a frame on a huge monitor.
        className="metal-bezel mx-auto w-[min(66rem,100%,calc((100svh_-_32rem)*16/9))]"
        style={
          {
            "--bezel-radius": "16px",
            "--bezel-rim": "1.5px",
            "--glint-delay": "0.35s",
          } as React.CSSProperties
        }
        initial={still ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="metal-bezel__face">
          {/* One bar for both halves: the frame is an instrument, and the
              readout says which job it is running. */}
          <div className="border-border/60 flex items-center gap-2 border-b px-3 py-2.5">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((dot) => (
                <span key={dot} className="bg-foreground/20 size-2 rounded-full" />
              ))}
            </div>

            <div className="bg-foreground/5 ml-2 flex-1 overflow-hidden rounded-full px-3 py-1">
              <motion.span
                key={still ? "static" : `${cycle}-${act}`}
                className="text-muted-foreground block overflow-hidden font-mono text-[10px] whitespace-nowrap"
                initial={still ? false : { width: 0 }}
                animate={{ width: "auto" }}
                transition={{ duration: 0.7, ease: "linear" }}
              >
                {act === "hunt"
                  ? // The real cursor when there is a real sweep. A spinner
                    // says "wait"; this says how much is left to wait for.
                    hunt && hunt.queries.length > 0
                    ? `sweeping ${hunt.cursor}/${hunt.queries.length} searches…`
                    : "sweeping your patch…"
                  : act === "build"
                    ? site
                    : `to: hello@${site}`}
              </motion.span>
            </div>
          </div>

          <div className="relative aspect-[16/9]">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${act}-${cycle}`}
                className="absolute inset-0"
                initial={still ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                {act === "hunt" && area ? (
                  <HuntFrame
                    area={area}
                    theme={theme === "dark" ? "dark" : "light"}
                    still={still}
                    cycle={cycle}
                    live={live}
                    found={hunt?.found}
                  />
                ) : act === "pitch" ? (
                  <PitchFrame
                    site={site}
                    figure={figure}
                    from={profile?.tradingName || "You"}
                    still={still}
                    cycle={cycle}
                  />
                ) : (
                  <BuildPage still={still} cycle={cycle} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* The caption under the artifact, not the main event. The step the
          frame is currently running lights up. */}
      <div
        ref={containerRef}
        className="relative mx-auto mt-10 flex max-w-2xl items-center justify-between px-4"
      >
        {STAGES.map((stage, index) => {
          const StageIcon = stage.icon;
          const on = stage.key === activeStage;

          return (
            <motion.div
              key={stage.key}
              className="relative flex flex-col items-center gap-3"
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + index * 0.12, duration: 0.4 }}
            >
              <div className="relative">
                {/* A pool of light under the running step. This one does
                    repeat, because it marks what is happening now rather
                    than decorating — a status light, not a progress bar. */}
                <AnimatePresence>
                  {on && !still && (
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute -inset-6 rounded-full"
                      style={{
                        background:
                          "radial-gradient(50% 50% at 50% 50%, color-mix(in oklab, var(--color-foreground) 22%, transparent), transparent 70%)",
                      }}
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.4 }}
                    />
                  )}
                </AnimatePresence>

                {on && !still && (
                  <motion.span
                    aria-hidden
                    className="border-foreground/40 pointer-events-none absolute inset-0 rounded-full border"
                    animate={{ scale: [1, 1.65], opacity: [0.55, 0] }}
                    transition={{
                      duration: 1.9,
                      repeat: Infinity,
                      ease: "easeOut",
                    }}
                  />
                )}

                <motion.div
                  ref={refs[index]}
                  className="metal-bezel relative z-10 size-14"
                  style={
                    {
                      "--glint-delay": `${0.8 + index * 0.12}s`,
                    } as React.CSSProperties
                  }
                  animate={still ? undefined : { scale: on ? 1.14 : 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                >
                  <div className="metal-bezel__face grid place-items-center">
                    <StageIcon
                      className={cn(
                        "size-5 transition-colors duration-300",
                        on ? "text-foreground" : "text-foreground/40",
                      )}
                      weight={on ? "regular" : "light"}
                    />
                  </div>
                </motion.div>
              </div>

              <p
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors duration-300",
                  on ? "text-foreground" : "text-muted-foreground/70",
                )}
              >
                {stage.label}
                {stage.soon && (
                  <span className="rounded-full border px-1 py-px font-mono text-[8px] leading-none tracking-wider uppercase">
                    soon
                  </span>
                )}
              </p>
            </motion.div>
          );
        })}

        {/* Keyed on the phase, so the current leg re-fires the moment the
            frame above switches job. The far leg stays dim rather than
            animating in parallel — two beams running at once is decoration,
            one running where the work is is a readout. */}
        {!still && (
          <>
            <AnimatedBeam
              key={`beam-a-${activeStage}-${cycle}`}
              containerRef={containerRef}
              fromRef={discoverRef}
              toRef={buildRef}
              {...beam}
              pathOpacity={0.16}
              gradientStartColor={
                activeStage === "discover" ? colors.start : colors.stop
              }
              duration={activeStage === "discover" ? 2 : 5}
              curvature={0}
            />
            <AnimatedBeam
              key={`beam-b-${activeStage}-${cycle}`}
              containerRef={containerRef}
              fromRef={buildRef}
              toRef={pitchRef}
              {...beam}
              pathOpacity={0.16}
              gradientStartColor={
                activeStage === "pitch" ? colors.start : colors.stop
              }
              duration={activeStage === "pitch" ? 2 : 5}
              curvature={0}
            />
          </>
        )}
      </div>

      <motion.p
        className="deck font-display text-muted-foreground mx-auto mt-10 max-w-sm text-center text-[15px] leading-relaxed text-balance"
        initial={still ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
      >
        {sweeping
          ? "Reading every business in your patch to find the ones nobody has built a site for. The list takes over this screen when it is done."
          : "Name a business and the agent starts building. Nothing leaves this screen until you decide it is worth sending."}
      </motion.p>
    </div>
  );
};
