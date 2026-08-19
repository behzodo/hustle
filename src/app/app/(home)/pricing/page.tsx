"use client";

import { useMemo, useState } from "react";
import { dark } from "@clerk/themes";
import { useQuery } from "convex/react";
import { PricingTable, useAuth } from "@clerk/nextjs";
import { formatDuration, intervalToDuration } from "date-fns";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useCurrentTheme } from "@/hooks/use-current-theme";
import {
  CHARGE_LABELS,
  CREDIT_COSTS,
  PACKS,
  TIERS,
  formatCredits,
  formatPrice,
  isPaidPlan,
  tierFor,
  whatItBuys,
  type Chargeable,
  type Pack,
} from "@/lib/pricing";

// Hex equivalents of the oklch tokens in globals.css. Clerk's appearance
// variables are read at runtime, so they can't reference CSS custom
// properties the way the rest of the app does.
const PALETTE = {
  light: {
    background: "#ffffff",
    text: "#3d3d3d",
    textSecondary: "#7a7a7a",
    primary: "#111111",
    onPrimary: "#ffffff",
    input: "#e8e8e8",
  },
  dark: {
    background: "#1f1f1f",
    text: "#dedede",
    textSecondary: "#9c9c9c",
    primary: "#fafafa",
    // Primary is near-white here, so the button label goes dark.
    onPrimary: "#141414",
    input: "#2b2b2b",
  },
} as const;

/**
 * What a credit actually buys.
 *
 * The first thing on the page, and deliberately before the plans. "1,000
 * credits" is a number nobody can price against their own month until they
 * know that a sweep is ten of them and a site is one — and the whole argument
 * for this pricing is that the expensive thing is finding businesses, not
 * building for them.
 */
const ORDER: Chargeable[] = ["sweep", "site", "pitch", "agent"];

const CostTable = () => (
  <div className="grid w-full gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
    {ORDER.map((kind) => (
      <div key={kind} className="bg-card/60 px-4 py-3.5 backdrop-blur-sm">
        <p className="text-xs text-muted-foreground">{CHARGE_LABELS[kind]}</p>
        <p className="mt-1 text-sm font-medium tabular-nums">
          {CREDIT_COSTS[kind]}
          <span className="text-muted-foreground font-normal">
            {CREDIT_COSTS[kind] === 1 ? " credit" : " credits"}
          </span>
        </p>
      </div>
    ))}
  </div>
);

interface CreditFieldProps {
  plan: string;
  credits: number;
  columns: number;
  accent?: boolean;
};

// One dot per credit, always. Grids are sized to each plan's own allowance
// and share a baseline, so four tiers spanning 25 to 4,000 read as a chart
// instead of four equal blocks.
const CreditField = ({ plan, credits, columns, accent }: CreditFieldProps) => (
  <div className="flex flex-col justify-end items-center gap-y-2.5 px-5 py-4">
    <div
      aria-hidden="true"
      className="grid gap-[1px]"
      style={{ gridTemplateColumns: `repeat(${columns}, 3px)` }}
    >
      {Array.from({ length: credits }, (_, index) => (
        <span
          key={index}
          style={{ animationDelay: `${Math.min(index, 60) * 8}ms` }}
          className={cn(
            "credit-dot size-[3px] rounded-full",
            accent ? "bg-primary" : "bg-foreground/70"
          )}
        />
      ))}
    </div>
    <p className="text-xs tabular-nums whitespace-nowrap">
      <span
        className={cn("font-medium", accent ? "text-primary" : "text-foreground")}
      >
        {plan}
      </span>
      <span className="text-muted-foreground">{` · ${formatCredits(credits)}`}</span>
    </p>
  </div>
);

// The dot grids are drawn at one pixel per credit, and Max is four thousand of
// them. Capped so the tallest column stays a chart rather than a wall, with
// the real number printed underneath either way.
const DOT_CAP = 600;

const dotsFor = (credits: number) => Math.min(credits, DOT_CAP);

// Most people reach this page from the Upgrade button, which appears once
// credits run low — so lead with where they actually stand.
const CreditStatus = () => {
  const { has } = useAuth();

  // The query returns null rather than throwing for signed-out visitors, so
  // there is nothing to gate on here.
  const balance = useQuery(api.credits.balance);

  const resetsIn = useMemo(() => {
    if (!balance) return null;

    try {
      return formatDuration(
        intervalToDuration({
          start: new Date(),
          end: new Date(Date.now() + balance.msBeforeReset),
        }),
        { format: ["months", "days", "hours"] }
      );
    } catch {
      return null;
    }
  }, [balance]);

  if (!balance) return null;

  const paid = isPaidPlan(has);
  const next = TIERS[TIERS.findIndex((tier) => tier.slug === tierFor(has).slug) + 1];
  const left = Math.max(0, balance.total);
  const isOut = left <= 0;
  const isLow = !isOut && left <= Math.max(CREDIT_COSTS.sweep, Math.floor(balance.allowance * 0.25));

  const sites = whatItBuys(left).sites;

  const message = isOut
    ? next
      ? `You're out. ${next.name} puts ${formatCredits(next.credits)} credits back in your hands today.`
      : `You're out${resetsIn ? ` — back in ${resetsIn}` : ""}.`
    : isLow && next
      ? `${formatCredits(left)} credits left — about ${sites} more sites. ${next.name} gives you ${formatCredits(next.credits)} a month.`
      : `${formatCredits(left)} credits left${paid ? "" : " on the free plan"}${resetsIn ? ` · resets in ${resetsIn}` : ""}.`;

  return (
    <p
      className={cn(
        "rounded-full border px-4 py-1.5 text-xs text-center tabular-nums",
        isOut || isLow
          ? "border-primary/40 bg-primary/10 text-foreground font-medium"
          : "border-border bg-card/60 text-muted-foreground"
      )}
    >
      {message}
    </p>
  );
};

/**
 * Top-ups, under the plans.
 *
 * Below rather than beside, on purpose. A pack is the answer to a month that
 * ran out early, not an alternative to subscribing — it is priced above the
 * plan rate for exactly that reason — and putting the two side by side invites
 * somebody to work out which is cheaper when the answer is always the plan.
 */
const PackButton = ({ pack, busy, onBuy }: {
  pack: Pack;
  busy: string | null;
  onBuy: (pack: Pack) => void;
}) => (
  <div className="flex flex-col gap-y-3 rounded-xl border bg-card/60 p-4 backdrop-blur-sm">
    <div>
      <p className="text-sm font-medium tabular-nums">{pack.name}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {formatPrice(pack.price)} once · never expires
      </p>
    </div>

    <Button
      size="sm"
      variant="outline"
      className="mt-auto h-9 rounded-lg"
      disabled={busy !== null}
      onClick={() => onBuy(pack)}
    >
      {busy === pack.slug ? "Opening Stripe…" : "Buy"}
    </Button>
  </div>
);

const Packs = () => {
  // The slug of the pack being bought, so only its own button shows the
  // pending state while the others simply lock.
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (pack: Pack) => {
    setBusy(pack.slug);

    try {
      const res = await fetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: pack.slug }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || !body?.url) {
        throw new Error(body?.error ?? "Could not open checkout");
      }

      // A full navigation rather than a router push: Stripe is not our app.
      window.location.href = body.url;
    } catch (error) {
      // Cleared only on failure. On success the page is already navigating
      // away, and re-enabling the button first lets somebody click it twice.
      setBusy(null);
      toast.error(error instanceof Error ? error.message : "Could not open checkout");
    }
  };

  return (
    <div className="flex w-full flex-col gap-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium">Need more this month?</h2>
        <p className="text-muted-foreground text-xs">
          One-off packs. They never expire.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PACKS.map((pack) => (
          <PackButton key={pack.slug} pack={pack} busy={busy} onBuy={buy} />
        ))}
      </div>
    </div>
  );
};

const Page = () => {
  const currentTheme = useCurrentTheme();
  const isDark = currentTheme === "dark";
  const palette = isDark ? PALETTE.dark : PALETTE.light;

  const free = TIERS[0];
  const top = TIERS[TIERS.length - 1];

  return (
    <div className="flex flex-col flex-1 min-h-0 max-w-5xl mx-auto w-full">
      {/* No backdrop of its own — the layout's flickering grid shows through.
          The solid base that used to sit here painted over it. */}
      <section className="flex flex-col items-center justify-center flex-1 min-h-0 overflow-y-auto gap-y-6 lg:gap-y-8 py-6">
        <div className="flex flex-col items-center gap-y-3">
          <p className="text-[0.7rem] font-medium tracking-[0.28em] text-primary uppercase">
            Pricing
          </p>
          {/* The multiple is the whole argument for upgrading, so it gets the
              display face's italic and the accent colour; the words around it
              stay upright and quiet. */}
          <h1 className="headline-display font-display text-center text-balance text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-[-0.03em]">
            Ship{" "}
            <span className="headline-figure italic text-primary tabular-nums">
              {Math.round(top.credits / free.credits)}&times;
            </span>{" "}
            more
          </h1>
          <p className="text-muted-foreground text-center text-balance text-base md:text-lg leading-relaxed max-w-lg">
            Credits buy the work.{" "}
            <span className="text-foreground">
              {formatCredits(free.credits)} free a month
            </span>{" "}
            — a swept patch and a handful of sites, before you pay anything.
          </p>
          <CreditStatus />
        </div>

        <CostTable />

        <div className="flex items-stretch divide-x divide-border rounded-xl border bg-card/60 backdrop-blur-sm">
          {TIERS.map((tier, index) => (
            <CreditField
              key={tier.slug}
              plan={tier.name}
              credits={dotsFor(tier.credits)}
              columns={Math.max(2, Math.round(Math.sqrt(dotsFor(tier.credits))))}
              accent={index === TIERS.length - 1}
            />
          ))}
        </div>

        <div className="w-full">
          <PricingTable
            appearance={{
              baseTheme: isDark ? dark : undefined,
              variables: {
                colorBackground: palette.background,
                colorText: palette.text,
                colorTextSecondary: palette.textSecondary,
                colorPrimary: palette.primary,
                colorTextOnPrimaryBackground: palette.onPrimary,
                colorInputBackground: palette.input,
                colorInputText: palette.text,
                colorNeutral: palette.text,
                borderRadius: "0.75rem",
                fontFamily: "inherit",
              },
              elements: {
                // Clerk lays plans out in two columns, which strands a fourth
                // plan alone on a second row.
                pricingTable:
                  "grid-cols-1! md:grid-cols-2! lg:grid-cols-4! gap-4! max-w-none!",
                pricingTableCard: "shadow-none! overflow-hidden! h-full!",
                pricingTableCardHeader: "p-4!",
                pricingTableCardTitle:
                  "text-base! font-semibold! tracking-tight!",
                pricingTableCardDescription:
                  "text-xs! leading-snug! mt-1!",
                pricingTableCardFee: "text-2xl! font-bold! tracking-tight!",
                pricingTableCardFeePeriod: "text-xs!",
                pricingTableCardFeaturesList: "gap-1.5!",
                pricingTableCardFeatures: "p-4!",
                pricingTableCardFeaturesListItemTitle: "text-xs!",
                pricingTableCardFooter: "p-4! pt-0!",
                pricingTableCardFooterButton: "h-9! rounded-lg! font-medium!",
              },
            }}
          />
        </div>

        <Packs />
      </section>
    </div>
  );
}

export default Page;
