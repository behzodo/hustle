"use client";

import { EvilRadialChart } from "@/components/evilcharts/charts/recharts-radial-chart";
import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";

import { SAMPLE_FUNNEL } from "../../constants";

// One ramp from light to dark, running the same direction as the funnel:
// the further a lead gets, the more contrast its ring carries.
const chartConfig = {
  found: {
    label: "Found",
    colors: { light: ["#d4d4d8"], dark: ["#3f3f46"] },
  },
  built: {
    label: "Built",
    colors: { light: ["#a1a1aa"], dark: ["#52525b"] },
  },
  pitched: {
    label: "Pitched",
    colors: { light: ["#71717a"], dark: ["#a1a1aa"] },
  },
  replied: {
    label: "Replied",
    colors: { light: ["#3f3f46"], dark: ["#d4d4d8"] },
  },
  signed: {
    label: "Signed",
    colors: { light: ["#111111"], dark: ["#fafafa"] },
  },
} satisfies ChartConfig;

export const FunnelChart = () => (
  <EvilRadialChart
    className="h-[260px] w-full"
    data={SAMPLE_FUNNEL}
    nameKey="stage"
    config={chartConfig}
    variant="semi"
  >
    <EvilRadialChart.Legend />
    <EvilRadialChart.Tooltip />
    <EvilRadialChart.RadialBar dataKey="count" />
  </EvilRadialChart>
);
