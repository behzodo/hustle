"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRightIcon,
  CheckIcon,
  HammerIcon,
  RefreshCwIcon,
  WrenchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { templateFor } from "@/blocks/templates";
import type { ProjectId } from "@/modules/projects/types";

import { useBuildFeed } from "../../use-discovery";

/**
 * The press room.
 *
 * The first version of this was a list of links beside an empty box, and it
 * was right about the data and wrong about everything else: what a person
 * wants from a screen that just built seventy-three websites is to see the
 * websites.
 *
 * So the tiles are the sites. Not screenshots and not mockups — each one is
 * the published page, live, in a frame scaled down and made inert. That costs
 * nothing to produce, is never out of date, and is the only preview that
 * cannot lie about what was actually shipped.
 *
 * A business still being built shows the same tile as a wireframe filling in,
 * and swaps to the real page the moment Convex says it is live. Watching that
 * happen is the point of the screen.
 */

/** The accent each template paints with. See src/blocks/render.ts. */
const ACCENT: Record<string, string> = {
  forge: "#f0522b",
  bloom: "#b47f86",
  // Its page is ink navy on paper; the hi-vis is the accent it uses on the
  // call button, and it is what reads as a colour at this size.
  plumbline: "#c8e21f",
  table: "#b3450e",
};

const accentFor = (template: string) => ACCENT[template] ?? "#8b8b8b";

/** What each look is for, in a few words. Shown when a tile is opened. */
const TEMPLATE_NOTE: Record<string, string> = {
  forge: "Gyms and barbers. Dark, condensed, stats set like weight plates.",
  bloom: "Salons and spas. Rose and plum, the photo in a mirror arch.",
  plumbline: "Trades. The phone number is the hero, set like van lettering.",
  table: "Food. Warm paper, menu leader dots, hours given a panel.",
};

/* -------------------------------------------------------------------------- */

/** How wide the page is rendered before being scaled into the tile. */
const FRAME_WIDTH = 1280;
const FRAME_HEIGHT = 900;

/**
 * One published site, rendered small.
 *
 * `pointer-events-none` and a `sandbox` with no `allow-scripts` between them
 * make it a picture: nothing inside can be clicked, focused, navigated or
 * run. The tile's own click opens the panel; the page underneath is scenery.
 */
const LivePage = ({ url, title }: { url: string; title: string }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    <iframe
      src={url}
      title={title}
      loading="lazy"
      tabIndex={-1}
      aria-hidden
      sandbox=""
      className="absolute top-0 left-0 origin-top-left border-0"
      style={{
        width: FRAME_WIDTH,
        height: FRAME_HEIGHT,
        transform: "scale(var(--page-scale))",
      }}
    />
  </div>
);

/** The blocks a page is made of, in the order every template stacks them. */
const BLOCKS = [
  "h-[28%]",
  "h-[12%]",
  "h-[10%]",
  "h-[12%]",
  "h-[5%]",
] as const;

/** Roughly a fifth of the seven seconds a build takes. */
const BLOCK_MS = 1300;

const Pressing = ({ name, accent }: { name: string; accent: string }) => {
  const still = useReducedMotion();
  const [laid, setLaid] = useState(still ? BLOCKS.length : 0);

  useEffect(() => {
    if (still) return;

    setLaid(0);
    const timer = setInterval(
      () => setLaid((count) => (count >= BLOCKS.length ? 1 : count + 1)),
      BLOCK_MS,
    );

    return () => clearInterval(timer);
    // Restarted per business: a new name on the press is a new page going up.
  }, [name, still]);

  return (
    <div className="absolute inset-0 flex flex-col gap-[3%] p-[6%]">
      {BLOCKS.map((height, index) => (
        <motion.div
          key={index}
          initial={false}
          animate={{ opacity: index < laid ? 1 : 0.1, scaleY: index < laid ? 1 : 0.5 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "top", background: accent }}
          className={`w-full rounded-sm ${height}`}
        />
      ))}
    </div>
  );
};

/* -------------------------------------------------------------------------- */

/** One published site, exactly as the feed query returns it. */
type Feed = NonNullable<ReturnType<typeof useBuildFeed>>;
type Site = Feed["recent"][number];

const Tile = ({
  title,
  trade,
  accent,
  children,
  onClick,
  live,
}: {
  title: string;
  trade: string;
  accent: string;
  children: React.ReactNode;
  onClick?: () => void;
  live: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="group focus-visible:ring-ring block w-full text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-default"
  >
    <div
      className="relative aspect-[4/3] overflow-hidden rounded-xl border transition-transform duration-300 group-enabled:group-hover:-translate-y-1"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 45%, transparent)`,
        boxShadow: `0 0 0 1px color-mix(in oklab, ${accent} 12%, transparent)`,
        // The page is laid out at desktop width and then shrunk, so the tile
        // shows the site as a visitor on a laptop sees it rather than the
        // mobile layout a narrow iframe would trigger.
        ["--page-scale" as string]: "0.24",
      }}
    >
      <div className="bg-background absolute inset-0" />
      {children}

      {live && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-enabled:group-hover:opacity-100"
          style={{ background: `linear-gradient(to top, ${accent}22, transparent 55%)` }}
        />
      )}
    </div>

    <div className="mt-2 min-w-0 px-0.5">
      <p className="truncate text-sm font-medium">{title}</p>
      <p className="text-muted-foreground truncate text-xs">{trade}</p>
    </div>
  </button>
);

/* -------------------------------------------------------------------------- */

/** What the robot did, opened up. */
const BehindTheScenes = ({
  site,
  onClose,
}: {
  site: Site | null;
  onClose: () => void;
}) => {
  const build = site?.build;
  const accent = accentFor(site?.template ?? "");

  return (
    <Sheet open={site !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {site && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 text-balance">{site.name}</SheetTitle>
              <SheetDescription>
                {site.trade}
                {site.score ? ` · scored ${site.score}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-7 px-4 pb-8">
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bg-muted/60 flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs transition-colors"
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: accent }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {site.url.replace(/^https:\/\//, "")}
                </span>
                <ArrowUpRightIcon className="size-3.5 shrink-0" />
              </a>

              <section>
                <h3 className="text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
                  What it wrote
                </h3>
                <p className="font-display mt-2 text-lg leading-snug text-balance">
                  {build?.headline ?? "—"}
                </p>
                {build?.services.length ? (
                  <ul className="text-muted-foreground mt-3 flex flex-wrap gap-1.5">
                    {build.services.map((service) => (
                      <li
                        key={service}
                        className="bg-muted rounded-full px-2.5 py-1 text-xs"
                      >
                        {service}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <section>
                <h3 className="text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
                  Why this look
                </h3>
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ background: accent }}
                  />
                  <span className="font-medium">{site.template}</span>
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {TEMPLATE_NOTE[site.template] ?? "Chosen from the trade."}
                </p>
              </section>

              {/* The checks. An empty list is worth showing — it is the
                  difference between "nothing was wrong" and "nobody looked". */}
              <section>
                <h3 className="text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
                  What the checker caught
                </h3>

                {build?.problems.length ? (
                  <ul className="mt-2 space-y-2">
                    {build.problems.map((problem) => (
                      <li key={problem} className="flex gap-2 text-sm">
                        <WrenchIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                        <span className="text-muted-foreground">{problem}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-500" />
                    Nothing. It came back clean first time.
                  </p>
                )}

                {build && build.repairs > 0 && (
                  <p className="text-muted-foreground mt-3 text-sm">
                    Sent back {build.repairs === 1 ? "once" : `${build.repairs} times`} and
                    rewritten before publishing.
                  </p>
                )}
              </section>

              {build?.photo && (
                <section>
                  <h3 className="text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
                    The photograph
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm">{build.photo}</p>
                </section>
              )}

              <section>
                <h3 className="text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
                  The receipt
                </h3>
                <dl className="mt-2 grid grid-cols-3 gap-3 font-mono text-sm tabular-nums">
                  <div>
                    <dt className="text-muted-foreground text-xs">took</dt>
                    <dd>{build ? `${build.seconds}s` : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">tokens</dt>
                    <dd>{build ? build.tokens.toLocaleString() : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">model</dt>
                    <dd className="truncate">{build?.provider ?? "—"}</dd>
                  </div>
                </dl>
                {build && (
                  <p className="text-muted-foreground mt-3 text-xs">
                    Cost nothing — every provider it used is on a free tier.
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

/* -------------------------------------------------------------------------- */

export const BuildTheatre = ({ projectId }: { projectId: ProjectId }) => {
  const feed = useBuildFeed(projectId, 12);
  const still = useReducedMotion();
  const [starting, setStarting] = useState(false);
  const [opened, setOpened] = useState<Site | null>(null);

  if (feed === undefined) {
    return <div className="bg-muted/40 h-72 animate-pulse rounded-2xl" />;
  }

  const { counts, building, recent, failed } = feed;

  if (counts.targets === 0) return null;

  const done = counts.live + counts.failed;
  const running = counts.building > 0 || counts.queued > 0;
  const pct = Math.round((done / counts.targets) * 100);

  const start = async (rebuild = false) => {
    setStarting(true);

    try {
      await fetch(`/api/hustles/${projectId}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rebuild }),
      });
    } finally {
      // Left on until the first status lands, so the button does not flash
      // back to "Build" while the queue is still filling.
      setTimeout(() => setStarting(false), 2500);
    }
  };

  return (
    <section className="border-border/60 bg-card/40 rounded-2xl border p-5 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-[-0.02em]">
            {running ? "On the press" : "Sites for this patch"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {running
              ? `${counts.building} building, ${counts.queued} waiting`
              : "Every one of these is live. Open one to see how it was made."}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <p className="font-mono text-2xl tabular-nums">
            {counts.live}
            <span className="text-muted-foreground text-base"> / {counts.targets}</span>
          </p>

          {/* Three states, not two. "Rewrite them all" is offered once nothing
              is left, because the copy is the part that goes stale and the
              addresses do not move — a client's link still resolves. */}
          {!running &&
            (counts.live < counts.targets ? (
              <Button size="sm" onClick={() => start(false)} disabled={starting}>
                <HammerIcon />
                {starting ? "Starting" : counts.live > 0 ? "Build the rest" : "Build them all"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => start(true)}
                disabled={starting}
              >
                <RefreshCwIcon />
                {starting ? "Starting" : "Rewrite them all"}
              </Button>
            ))}
        </div>
      </header>

      {/* One bar rather than a spinner: the useful question during a long run
          is how much is left, and a spinner cannot answer it. */}
      <div className="bg-muted mt-5 h-1 w-full overflow-hidden rounded-full">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--foreground)" }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={still ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence initial={false} mode="popLayout">
          {/* Being built first, so the thing that is moving is at the top of
              the wall rather than somewhere down the middle of it. */}
          {building.map((lead) => (
            <motion.div
              key={lead._id}
              layout
              initial={still ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Coloured before it exists. The template is chosen from the
                  trade and `templateFor` is pure, so the tile can be the right
                  colour while the page is still being written — and the swap
                  to the real site is a page appearing rather than the whole
                  tile changing character. */}
              <Tile
                title={lead.name}
                trade={lead.trade}
                accent={accentFor(templateFor(lead.trade))}
                live={false}
              >
                <Pressing name={lead.name} accent={accentFor(templateFor(lead.trade))} />
              </Tile>
            </motion.div>
          ))}

          {recent.map((site) => (
            <motion.div
              key={site._id}
              layout
              initial={still ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <Tile
                title={site.name}
                trade={site.trade}
                accent={accentFor(site.template)}
                live
                onClick={() => setOpened(site)}
              >
                <LivePage url={site.url} title={site.name} />
              </Tile>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {recent.length === 0 && building.length === 0 && (
        <p className="text-muted-foreground mt-6 text-sm">
          No sites yet. Build them and they appear here as they go up.
        </p>
      )}

      {failed.length > 0 && (
        <p className="text-muted-foreground mt-5 text-xs">
          {counts.failed} could not be built
          {failed[0]?.error ? ` — ${failed[0].error.slice(0, 90)}` : ""}. They go back
          in the queue next time you build.
        </p>
      )}

      <BehindTheScenes site={opened} onClose={() => setOpened(null)} />
    </section>
  );
};
