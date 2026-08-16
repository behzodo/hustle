"use client";

import { EvilAreaChart } from "@/components/evilcharts/charts/recharts-area-chart";
import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";

import { SAMPLE_PIPELINE } from "../../constants";

// Monochrome on purpose. The product's whole palette is one near-black /
// near-white primary, and a stock chart green would be the only saturated
// thing on the page. Signed sits at full contrast, open sits back — the
// hierarchy is carried by value, not hue.
const chartConfig = {
  desktop: {
    label: "Signed",
    colors: {
      light: ["#111111"],
      dark: ["#fafafa"],
    },
  },
  mobile: {
    label: "Open",
    colors: {
      light: ["#a1a1aa"],
      dark: ["#71717a"],
    },
  },
} satisfies ChartConfig;

export const PipelineChart = () => (
  <EvilAreaChart
    data={SAMPLE_PIPELINE}
    config={chartConfig}
    className="h-[260px] w-full"
    stackType="stacked"
  >
    <EvilAreaChart.Grid />
    <EvilAreaChart.XAxis
      dataKey="month"
      tickFormatter={(value: string) => value.replace("Week ", "W")}
    />
    <EvilAreaChart.YAxis dataKey="desktop" />
    <EvilAreaChart.Legend isClickable />
    <EvilAreaChart.Tooltip />
    <EvilAreaChart.Area dataKey="desktop" variant="gradient" isClickable>
      <EvilAreaChart.ActiveDot variant="default" />
    </EvilAreaChart.Area>
    <EvilAreaChart.Area dataKey="mobile" variant="gradient" isClickable>
      <EvilAreaChart.ActiveDot variant="default" />
    </EvilAreaChart.Area>
  </EvilAreaChart>
);
