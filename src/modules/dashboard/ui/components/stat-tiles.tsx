"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import {
  ArrowUpRightIcon,
  CoinsIcon,
  HandshakeIcon,
  LayoutIcon,
  WalletIcon,
  type Icon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { api } from "@/../convex/_generated/api";
import { NumberTicker } from "@/components/ui/number-ticker";
import { useProjects } from "@/modules/projects/use-projects";
import { PANEL_CLASS, PanelLabel, SampleBadge } from "./panel";
import {
  SAMPLE_CREDITS_LEFT,
  SAMPLE_FUNNEL,
  SAMPLE_LEADS,
  SAMPLE_SITES_TOTAL,
} from "../../constants";

interface TileProps {
  label: string;
  /** Counted up to, not printed — see <NumberTicker /> below. */
  value: number;
  /** Currency mark, set outside the ticker so only the digits animate. */
  prefix?: string;
  hint: string;
  icon: Icon;
  href?: string;
  /** Numbers with nothing behind them get marked rather than quietly shown. */
  sample?: boolean;
  /** The one tile that carries the accent, as in any well-set stat row. */
  featured?: boolean;
  loading?: boolean;
}

const Tile = ({
  label,
  value,
  prefix,
  hint,
  icon: Icon,
  href,
  sample,
  featured,
  loading,
}: TileProps) => {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        {/* On the chrome tile every colour is inherited from the plate rather
            than named, so the label, hint, badge and icon stay legible
            whichever way the metal is mixed for the current theme. */}
        <PanelLabel className={featured ? "text-inherit opacity-65" : ""}>
          {label}
        </PanelLabel>
        <Icon
          weight="light"
          className={cn(
            "size-[18px] shrink-0",
            featured ? "text-inherit opacity-65" : "text-muted-foreground",
          )}
        />
      </div>

      {/* Fraunces at display optical size — the same face the headlines use,
          so the figures belong to the brand instead of the chart library. */}
      <p
        className={cn(
          "headline-figure font-display mt-4 text-4xl leading-none tracking-[-0.03em] tabular-nums",
          loading && "text-muted-foreground/40",
        )}
      >
        {loading ? (
          "—"
        ) : (
          <>
            {/* NumberTicker hardcodes text-black AND dark:text-white. The
                dark: one is its own tailwind-merge group, so overriding only
                the bare colour left the figure white on the white featured
                tile — both have to be handed back to the heading. */}
            <NumberTicker
              value={value}
              prefix={prefix}
              className="text-inherit tracking-[inherit] dark:text-inherit"
              // Green means money, so only the money figure earns it. The
              // counts settle out of a soft blur instead — same sense of
              // arriving at a number, without implying profit.
              activeClassName={
                prefix
                  ? "text-emerald-500 dark:text-emerald-400"
                  : "opacity-45 blur-[2px]"
              }
            />
          </>
        )}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <p
          className={cn(
            "text-xs",
            featured ? "text-inherit opacity-65" : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
        {/* The badge's muted grey is tuned for the page background, and goes
            invisible on the plated tile. */}
        {sample && (
          <SampleBadge
            className={
              featured ? "border-current/30 text-inherit opacity-65" : undefined
            }
          />
        )}
        {href && (
          <ArrowUpRightIcon
            className={cn(
              "ml-auto size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
              featured ? "text-inherit opacity-65" : "text-muted-foreground",
            )}
          />
        )}
      </div>
    </>
  );

  const className = cn(
    PANEL_CLASS,
    "group p-5 transition-colors",
    // The accent tile is a milled plate — the same chrome as the New hustle
    // button and the support disc, rather than a flat white rectangle sitting
    // among three dark ones. metal-plate paints an opaque gradient and carries
    // its own rim light, so the panel's fill and border are handed back.
    //
    // [&>*] because the plate's sheen is painted at z-index 1: without a layer
    // of their own the label and the figure sweep under it.
    featured &&
      "metal-plate bg-transparent dark:bg-transparent border-transparent [&>*]:relative [&>*]:z-[2]",
    href && !featured && "hover:bg-muted/50",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
};

export const StatTiles = () => {
  const projects = useProjects();
  const credits = useQuery(api.credits.status);

  const signed = SAMPLE_FUNNEL.find((s) => s.stage === "signed")?.count ?? 0;
  const pipeline = SAMPLE_LEADS.reduce((sum, lead) => sum + lead.value, 0);

  // A brand new account reads zero across the board, which makes the whole
  // dashboard look broken rather than empty. Fall back to a sample figure —
  // and say so on the tile, so a real zero is never dressed up as traction.
  const builtCount = projects?.length ?? 0;
  const creditsCount = credits?.remainingPoints ?? 0;
  const buildIsSample = projects !== undefined && builtCount === 0;
  const creditsIsSample = credits !== undefined && creditsCount === 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        featured
        label="Sites built"
        value={buildIsSample ? SAMPLE_SITES_TOTAL : builtCount}
        sample={buildIsSample}
        hint="Everything you have generated"
        icon={LayoutIcon}
        loading={projects === undefined}
      />
      <Tile
        label="Credits left"
        value={creditsIsSample ? SAMPLE_CREDITS_LEFT : creditsCount}
        sample={creditsIsSample}
        hint="Resets on your billing period"
        icon={CoinsIcon}
        href="/pricing"
        loading={credits === undefined}
      />
      <Tile
        sample
        label="Clients signed"
        value={signed}
        hint="Pitches that turned into work"
        icon={HandshakeIcon}
      />
      <Tile
        sample
        label="Pipeline"
        value={pipeline}
        prefix="$"
        hint="Value of everything open"
        icon={WalletIcon}
      />
    </div>
  );
};
