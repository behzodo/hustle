'use client'
import DottedMap from 'dotted-map'
import { Area, AreaChart, CartesianGrid } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

export default function FeaturesSection() {
    return (
        <section className="overflow-hidden px-4 py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-2 lg:px-6">
                <h2 className="headline-display font-display text-muted-foreground max-w-4xl text-balance text-4xl leading-[1.02] tracking-[-0.02em]">
                    <span className="text-foreground">Built before the call.</span> <br /> Live before they answer.
                </h2>
                <div className="mt-8 grid rounded-xl border md:mt-16 md:grid-cols-2">
                    <div className="row-span-2 grid grid-rows-subgrid gap-6 md:gap-0">
                        <div className="p-6 sm:p-12">
                            <p className="text-muted-foreground text-balance text-lg font-medium">
                                <span className="text-foreground">Works anywhere they are.</span> Sites are hosted for you, so the link opens instantly whether you send it by email, DM, or text.
                            </p>
                        </div>

                        <div
                            aria-hidden
                            className="relative"
                        >
                            <div className="absolute inset-0 z-10 m-auto size-fit -translate-y-full">
                                <div className="rounded-(--radius) text-muted-foreground z-1 ring-foreground/6.5 shadow-black/6.5 relative flex size-fit w-fit items-center gap-2 bg-neutral-900/75 px-3 py-1 text-xs font-medium shadow-lg ring backdrop-blur">
                                    <span className="text-lg">▲</span> Sandbox ready at <span className="text-foreground">your live URL</span>
                                </div>
                                <div className="rounded-(--radius) bg-background ring-foreground/6.5 absolute inset-2 -bottom-2 mx-auto px-3 py-4 text-xs font-medium shadow-md shadow-black/5 ring"></div>
                            </div>

                            <div className="mask-radial-at-center mask-radial-from-25% mask-radial-[50%_50%] relative overflow-hidden opacity-25">
                                <Map />
                            </div>
                        </div>
                    </div>
                    <div className="row-span-2 grid grid-rows-subgrid gap-6 overflow-hidden border-t p-6 sm:p-12 md:gap-0 md:border-0 md:border-l dark:bg-transparent">
                        <div className="relative z-10">
                            <p className="text-muted-foreground text-balance text-lg font-medium">
                                <span className="text-foreground">Every prospect in one place.</span> Each business keeps its own site, notes, and revisions, so you never lose track of who you pitched.
                            </p>
                        </div>
                        <div
                            aria-hidden
                            className="mask-radial-at-top-left mask-radial-[90%_80%] mask-radial-from-75%"
                        >
                            <div className="bg-card relative mx-auto flex aspect-video flex-col justify-between rounded-xl border pb-6">
                                <div className="mb-6 flex gap-1.5 border-b p-3">
                                    <div className="bg-foreground/10 size-1.5 rounded-full"></div>
                                    <div className="bg-foreground/10 size-1.5 rounded-full"></div>
                                    <div className="bg-foreground/10 size-1.5 rounded-full"></div>
                                </div>

                                <div className="bg-foreground/2 ring-foreground/6.5 mx-6 mt-auto h-32 rounded-xl shadow-xl ring" />
                            </div>
                        </div>
                    </div>
                    <div className="col-span-full border-y p-12 lg:py-20">
                        <p className="headline-display font-display text-center text-4xl leading-[1] tracking-[-0.03em] tabular-nums lg:text-7xl">
                            1 lead{' '}
                            <span className="text-muted-foreground">
                                1 <span className="headline-figure italic text-primary">finished site</span>
                            </span>
                        </p>
                    </div>
                    <div className="relative col-span-full">
                        <div className="absolute z-10 max-w-lg px-6 pr-12 pt-6 md:px-12 md:pt-12">
                            <p className="mb-8 text-balance text-lg font-medium">
                                Credits, tracked as you pitch. <span className="text-muted-foreground">See exactly how many sites you have left and when they reset — no surprise overages.</span>
                            </p>
                        </div>
                        <MonitoringChart />
                    </div>
                </div>
            </div>
        </section>
    )
}

const map = new DottedMap({ height: 55, grid: 'diagonal' })

const points = map.getPoints()

const svgOptions = {
    backgroundColor: 'var(--color-background)',
    color: 'currentColor',
    radius: 0.15,
}

const Map = () => {
    const viewBox = `0 0 120 60`
    return (
        <svg
            viewBox={viewBox}
            style={{ background: svgOptions.backgroundColor }}
        >
            {points.map((point, index) => (
                <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={svgOptions.radius}
                    fill={svgOptions.color}
                />
            ))}
        </svg>
    )
}

// Two steps off the greyscale chart ramp rather than two hues, so the areas
// separate by value the way the rest of the palette does.
const chartConfig = {
    desktop: {
        label: 'Desktop',
        color: 'var(--chart-1)',
    },
    mobile: {
        label: 'Mobile',
        color: 'var(--chart-3)',
    },
} satisfies ChartConfig

const chartData = [
    { month: 'May', desktop: 56, mobile: 224 },
    { month: 'June', desktop: 56, mobile: 224 },
    { month: 'January', desktop: 126, mobile: 252 },
    { month: 'February', desktop: 205, mobile: 410 },
    { month: 'March', desktop: 200, mobile: 126 },
    { month: 'April', desktop: 400, mobile: 800 },
]

const MonitoringChart = () => {
    return (
        <ChartContainer
            className="h-120 aspect-auto md:h-96"
            config={chartConfig}
        >
            <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{
                    left: 0,
                    right: 0,
                }}
            >
                <defs>
                    <linearGradient
                        id="fillDesktop"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stopColor="var(--color-desktop)"
                            stopOpacity={0.8}
                        />
                        <stop
                            offset="55%"
                            stopColor="var(--color-desktop)"
                            stopOpacity={0.1}
                        />
                    </linearGradient>
                    <linearGradient
                        id="fillMobile"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop
                            offset="0%"
                            stopColor="var(--color-mobile)"
                            stopOpacity={0.8}
                        />
                        <stop
                            offset="55%"
                            stopColor="var(--color-mobile)"
                            stopOpacity={0.1}
                        />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <ChartTooltip
                    active
                    cursor={false}
                    content={<ChartTooltipContent className="dark:bg-muted" />}
                />
                <Area
                    strokeWidth={2}
                    dataKey="mobile"
                    type="stepBefore"
                    fill="url(#fillMobile)"
                    fillOpacity={0.1}
                    stroke="var(--color-mobile)"
                    stackId="a"
                />
                <Area
                    strokeWidth={2}
                    dataKey="desktop"
                    type="stepBefore"
                    fill="url(#fillDesktop)"
                    fillOpacity={0.1}
                    stroke="var(--color-desktop)"
                    stackId="a"
                />
            </AreaChart>
        </ChartContainer>
    )
}
