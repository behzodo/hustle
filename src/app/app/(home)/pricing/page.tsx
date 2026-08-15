"use client";

import { useMemo } from "react";
import { dark } from "@clerk/themes";
import { useQuery } from "@tanstack/react-query";
import { PricingTable, useAuth } from "@clerk/nextjs";
import { formatDuration, intervalToDuration } from "date-fns";

import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useCurrentTheme } from "@/hooks/use-current-theme";
import {
  FREE_POINTS,
  PRO_POINTS,
  MAX_POINTS,
  creditsFor,
  isPaidPlan,
} from "@/lib/entitlements";

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

interface CreditFieldProps {
  plan: string;
  credits: number;
  columns: number;
  accent?: boolean;
};

// One dot per build, always. Grids are sized to each plan's own allowance
// and share a baseline, so three tiers spanning 2 to 1000 read as a chart
// instead of three equal blocks.
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
      <span className="text-muted-foreground">{` · ${credits}`}</span>
    </p>
  </div>
);

// Most people reach this page from the Upgrade button, which appears once
// credits run low — so lead with where they actually stand.
const CreditStatus = () => {
  const trpc = useTRPC();
  const { isSignedIn, has } = useAuth();

  const { data: usage } = useQuery({
    ...trpc.usage.status.queryOptions(),
    enabled: !!isSignedIn,
    retry: false,
  });

  const resetsIn = useMemo(() => {
    if (!usage) return null;

    try {
      return formatDuration(
        intervalToDuration({
          start: new Date(),
          end: new Date(Date.now() + usage.msBeforeNext),
        }),
        { format: ["months", "days", "hours"] }
      );
    } catch {
      return null;
    }
  }, [usage]);

  if (!usage) return null;

  const paid = isPaidPlan(has);
  const total = creditsFor(has);
  const left = Math.max(0, usage.remainingPoints);
  const isOut = left <= 0;
  const isLow = !isOut && left <= Math.max(1, Math.floor(total * 0.25));

  const message = paid
    ? isOut
      ? `All ${total} builds used${resetsIn ? ` — back in ${resetsIn}` : ""}.`
      : `${left} of ${total} builds left. Keep going.`
    : isOut
      ? `You're out. Pro puts ${PRO_POINTS} builds back in your hands today.`
      : isLow
        ? `Only ${left} build${left === 1 ? "" : "s"} left. Pro gives you ${PRO_POINTS}.`
        : `${left} of ${total} builds left${resetsIn ? ` · resets in ${resetsIn}` : ""}.`;

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

const Page = () => {
  const currentTheme = useCurrentTheme();
  const isDark = currentTheme === "dark";
  const palette = isDark ? PALETTE.dark : PALETTE.light;

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
              500&times;
            </span>{" "}
            more
          </h1>
          <p className="text-muted-foreground text-center text-balance text-base md:text-lg leading-relaxed max-w-lg">
            One credit builds one app.{" "}
            <span className="text-foreground">
              {FREE_POINTS} free a month, {PRO_POINTS} on Pro, {MAX_POINTS} on
              Max
            </span>{" "}
            — down to 10&cent; a build.
          </p>
          <CreditStatus />
        </div>

        <div className="flex items-stretch divide-x divide-border rounded-xl border bg-card/60 backdrop-blur-sm">
          <CreditField plan="Free" credits={FREE_POINTS} columns={2} />
          <CreditField plan="Pro" credits={PRO_POINTS} columns={10} />
          <CreditField plan="Max" credits={MAX_POINTS} columns={50} accent />
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
                // Clerk lays plans out in two columns, which strands a third
                // plan alone on a second row.
                pricingTable:
                  "grid-cols-1! md:grid-cols-3! gap-4! max-w-none!",
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
      </section>
    </div>
  );
}

export default Page;
