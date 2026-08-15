import { FREE_POINTS, MAX_POINTS } from '@/lib/entitlements'

// The template shipped invented traction numbers (GitHub stars, active
// users). These come from the billing config instead, so they stay true.
export default function StatsSection() {
    return (
        <section className="py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-6">
                <p className="headline-display font-display text-muted-foreground max-w-4xl text-balance text-4xl leading-[1.02] tracking-[-0.02em] lg:text-5xl">
                    <span className="text-foreground">Priced per site.</span> Not per seat, per lead, or per month of hoping.
                </p>

                {/* Figures set in the display face with tabular figures, so the
                    three numbers line up on the same stems down the row. */}
                <div className="mt-32 grid gap-12 md:grid-cols-3 xl:mt-44">
                    <div className="space-y-3 border-t pt-6">
                        <div className="headline-figure font-display text-6xl leading-none tracking-[-0.03em] tabular-nums">{FREE_POINTS} <span className="italic text-primary">free</span></div>
                        <p className="text-muted-foreground">Sites every month, no card required</p>
                    </div>
                    <div className="space-y-3 border-t pt-6">
                        <div className="headline-figure font-display text-6xl leading-none tracking-[-0.03em] tabular-nums">10&cent;</div>
                        <p className="text-muted-foreground">Per site on the top plan</p>
                    </div>
                    <div className="space-y-3 border-t pt-6">
                        <div className="headline-figure font-display text-6xl leading-none tracking-[-0.03em] tabular-nums">{MAX_POINTS.toLocaleString('en-US')}</div>
                        <p className="text-muted-foreground">Sites a month at the ceiling</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
