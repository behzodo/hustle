"use client";

import { EvilAreaChart } from "@/components/evilcharts/charts/recharts-area-chart";
import { type ChartConfig } from "@/components/evilcharts/ui/recharts-chart";

import { SAMPLE_PIPELINE } from "../../constants";

// Monochrome on purpose. The product's whole palette is one near-black /
// near-white primary, and a stock chart green would be the only saturated
// thing on the page. Signed sits at full contrast, open sits back — the
// hierarchy is carried by value, not hue.
//
// The dark values are deliberately bright. A mid-zinc that reads fine on a
// white page disappears against this one, and the second series has to stay
// separable from the first at a glance.
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
      light: ["#9f9fa9"],
      dark: ["#a1a1aa"],
    },
  },
} satisfies ChartConfig;

const money = (value: number) =>
  value >= 1000 ? `$${value / 1000}k` : `$${value}`;

export const PipelineChart = () => (
  <EvilAreaChart
    data={SAMPLE_PIPELINE}
    config={chartConfig}
    className="h-full min-h-[260px] w-full"
    stackType="stacked"
  >
    <EvilAreaChart.Grid />
    <EvilAreaChart.XAxis
      dataKey="month"
      tickFormatter={(value: string) => value.replace("Week ", "W")}
    />
    {/* A money axis without its currency mark is just a number. */}
    <EvilAreaChart.YAxis dataKey="desktop" tickFormatter={money} />
    <EvilAreaChart.Legend isClickable />
    <EvilAreaChart.Tooltip />
    {/* strokeVariant defaults to "dashed", which on a near-black ground left
        both series as faint hairlines. Solid is what makes the shape read. */}
    <EvilAreaChart.Area
      dataKey="desktop"
      variant="gradient"
      strokeVariant="solid"
      isClickable
    >
      <EvilAreaChart.ActiveDot variant="default" />
    </EvilAreaChart.Area>
    <EvilAreaChart.Area
      dataKey="mobile"
      variant="hatched"
      strokeVariant="solid"
      isClickable
    >
      <EvilAreaChart.ActiveDot variant="default" />
    </EvilAreaChart.Area>
  </EvilAreaChart>
);
