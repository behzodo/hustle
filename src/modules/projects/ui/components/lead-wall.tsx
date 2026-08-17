"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  ArrowSquareOutIcon,
  CrosshairIcon,
  PhoneIcon,
  StarIcon,
  WarningIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { ProjectId } from "@/modules/projects/types";
import { describeGap, type WebPresence } from "@/modules/hustles/discovery/lead";
import { useHunt, useLeads } from "@/modules/hustles/use-discovery";

/**
 * What the sweep came back with, dropped into place.
 *
 * The explainer this replaces is a promise; this is the receipt. So it takes
 * the whole canvas — no heading competing with it, no standfirst underneath,
 * nothing but the businesses and the one line saying how many there are. A
 * wall of real names is the only argument this screen needs to make.
 *
 * They fall in rather than fade in. A fade says the list was always there and
 * is only now visible; a drop says it was just produced, which is what
 * actually happened — and it arrives in reading order, so the eye starts at
 * the best prospect rather than wherever the animation finished.
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

const Tile = ({
  lead,
  delay,
  still,
}: {
  lead: {
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
  delay: number;
  still: boolean;
}) => (
  <motion.article
    className={cn(
      "bg-card relative flex flex-col gap-2 rounded-xl border p-4",
      // The ones with nothing at all are the cleanest pitch, so they carry
      // the heavier edge. Everything else on this screen is the same weight.
      lead.presence === "none" ? "border-foreground/25" : "border-border",
    )}
    initial={still ? false : { y: -140, opacity: 0, rotate: delay % 0.2 > 0.1 ? -2.5 : 2.5 }}
    animate={{ y: 0, opacity: 1, rotate: 0 }}
    transition={
      still
        ? undefined
        : // A spring rather than an ease, because the overshoot is the point:
          // a tile that stops dead has been placed, one that settles has
          // landed.
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
          louder than a number can. */}
      <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
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
}: {
  projectId: ProjectId;
  areaLabel?: string;
}) => {
  const still = Boolean(useReducedMotion());
  const hunt = useHunt(projectId);
  const leads = useLeads(projectId, { limit: WALL_LIMIT });

  if (leads === undefined) return null;

  const step = leads.length > 0 ? CASCADE_MS / leads.length / 1000 : 0;

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* One line, not a header block. The wall is the content. */}
      <motion.div
        className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
        initial={still ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="headline-display font-display text-2xl leading-none tracking-[-0.03em] md:text-3xl">
          <span className="headline-figure text-primary tabular-nums">
            {hunt?.found ?? leads.length}
          </span>{" "}
          {/* OpenStreetMap cannot tell us a business has no website, only
              that nobody wrote one down. When the sweep fell through to it,
              the headline says what was actually established. */}
          {hunt?.provider === "osm" ? "worth checking" : "with no website"}
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

      {hunt?.status === "failed" && (
        <div className="border-destructive/40 bg-destructive/5 mb-6 flex items-start gap-3 rounded-xl border p-3">
          <WarningIcon className="text-destructive mt-0.5 size-4 shrink-0" weight="fill" />
          <p className="text-muted-foreground text-xs">
            The sweep stopped early — {hunt.error} Everything it found before
            that is below.
          </p>
        </div>
      )}

      {leads.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center gap-3 py-24 text-center">
          <CrosshairIcon className="size-8 opacity-40" />
          <p className="text-sm">
            {hunt && hunt.scanned > 0
              ? `Every business in this patch already has a website. ${hunt.scanned} swept, none to pitch.`
              : "Nothing inside this patch. Google answered, but every result sat outside the shape you drew — try a wider patch, or one over a town."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {leads.map((lead, index) => (
            <Tile
              key={lead._id}
              lead={lead}
              delay={index * step}
              still={still}
            />
          ))}
        </div>
      )}
    </div>
  );
};
