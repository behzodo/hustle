"use client";

// Phosphor's entry point is client-only — it reads IconContext — so anything
// importing an icon has to be a client component. Everything this view renders
// is already interactive, so nothing is lost by moving the boundary up here.

import Link from "next/link";
import { PlusIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { EvilGridBarChart } from "@/components/evilcharts/blocks/grid-bar-chart";

import { SAMPLE_SITES_BUILT } from "../../constants";
import { DashboardBackdrop } from "../components/dashboard-backdrop";
import { FunnelChart } from "../components/funnel-chart";
import { LeadsGrid } from "../components/leads-grid";
import { Panel, PanelLabel, SampleBadge } from "../components/panel";
import { PipelineChart } from "../components/pipeline-chart";
import { RecentHustles } from "../components/recent-hustles";
import { StatTiles } from "../components/stat-tiles";

/** Panel heading — same type ramp as the rest of the product. */
const PanelHead = ({
  title,
  hint,
  sample,
  action,
}: {
  title: string;
  hint?: string;
  sample?: boolean;
  action?: React.ReactNode;
}) => (
  // px-5 py-4 rather than a flat p-5: the head is a label strip, and the
  // square padding gave it the presence of a section of its own.
  <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <h2 className="font-display headline-display text-lg tracking-[-0.02em]">
          {title}
        </h2>
        {sample && <SampleBadge />}
      </div>
      {hint && <p className="text-muted-foreground mt-0.5 text-sm">{hint}</p>}
    </div>
    {action}
  </div>
);

export const DashboardView = () => (
  <div className="relative flex-1">
    <DashboardBackdrop />

    {/* Positioned, and after the backdrop in source order — that is the only
        thing keeping it painted above it, since both sit at the same layer. */}
    <div className="relative flex w-full flex-col gap-4 p-4 md:p-6">
      {/* Page head. items-center, not items-end: against a three-line text
        block the button was landing level with nothing, reading as adrift. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PanelLabel>Overview</PanelLabel>
          <h1 className="headline-display font-display mt-2 text-3xl leading-[1.02] tracking-[-0.03em] text-balance md:text-4xl">
            Your{" "}
            <span className="headline-figure text-primary italic">hustle</span>,
            end to end.
          </h1>
          <p className="deck font-display text-muted-foreground mt-2 text-balance">
            Sites built, credits left, and every lead between found and signed.
          </p>
        </div>

        <Button
          asChild
          className="h-11 rounded-xl px-5 text-sm font-medium tracking-tight"
        >
          <Link href="/hustles/new">
            <PlusIcon className="size-4" />
            Build a site
          </Link>
        </Button>
      </div>

      <StatTiles />

      {/* Pipeline gets the wide column — it is the money chart. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead
            sample
            title="Pipeline value"
            hint="Signed against everything still open, by week."
          />
          {/* flex-1 so the chart absorbs the extra height when the taller card
            in the row stretches this one — otherwise the surplus pools as
            blank space under the plot. */}
          <div className="flex flex-1 p-2">
            <PipelineChart />
          </div>
        </Panel>

        <Panel>
          <PanelHead
            sample
            title="Lead funnel"
            hint="Where every business you found sits."
          />
          <div className="flex flex-1 p-2">
            <FunnelChart />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHead sample title="Sites shipped" hint="Last seven days." />
          <div className="flex flex-1 flex-col">
            <EvilGridBarChart
              data={SAMPLE_SITES_BUILT}
              totalLabel="[Σ] Sites"
              peakLabel="[⬆] Best day"
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title="Recent hustles"
            hint="Straight from your projects."
          />
          <div className="p-5">
            <RecentHustles />
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHead
          sample
          title="Latest leads"
          hint="Sortable — click a column header to reorder."
        />
        <div className="p-5">
          <LeadsGrid />
        </div>
      </Panel>
    </div>
  </div>
);
