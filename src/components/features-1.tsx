import { Card } from '@/components/ui/card'
import { MonitorPlay, FolderTree, Share2, Layers } from 'lucide-react'

export default function Features() {
    return (
        <section
            id="features"
            className="py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-6">
                <div className="max-w-4xl space-y-4">
                    <p className="eyebrow text-primary font-medium">Features</p>
                    <h2 className="headline-display font-display text-muted-foreground text-balance text-4xl leading-[1.02] tracking-[-0.02em] lg:text-5xl">
                        <span className="text-foreground">A finished site beats a pitch deck.</span> <br /> Every time.
                    </h2>
                </div>
                <div className="*:bg-background mt-8 grid gap-3 md:mt-16 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="p-8">
                        <p className="text-muted-foreground max-w-xs text-lg font-medium">
                            <span className="text-foreground">A real site, not a mockup.</span> It loads on their phone, with their business name, hours, and services already filled in.
                        </p>

                        <div className="my-16">
                            <div
                                aria-hidden
                                className="bg-background relative mx-auto aspect-square w-10/12 rounded-xl border"
                            >
                                <div className="bg-card ring-foreground/6.5 absolute bottom-0 right-0 aspect-square w-3/5 translate-x-8 translate-y-16 rounded-xl shadow-xl ring" />
                            </div>
                        </div>
                    </Card>
                    <Card className="lg:col-span-2">
                        <div className="p-8">
                            <p className="text-muted-foreground max-w-xs text-lg font-medium">
                                <span className="text-foreground">Built from public information.</span> Hustle reads what is already online about the business and writes the copy around it.
                            </p>
                        </div>

                        <div className="mask-x-from-65% mt-6 pt-2">
                            <div
                                aria-hidden
                                className="bg-linear-to-b from-foreground/5 ring-foreground/6.5 relative h-72 rounded-xl shadow-xl ring"
                            ></div>
                        </div>
                    </Card>
                </div>

                <div className="max-sm:*:not-last:border-b max-sm:*:not-last:pb-3 mt-12 grid gap-3 *:max-w-xs sm:grid-cols-2 md:mt-16 md:gap-y-6 lg:mt-24 lg:grid-cols-4 lg:gap-6">
                    <p className="text-muted-foreground text-balance">
                        <span className="text-foreground font-medium">
                            <MonitorPlay className="inline size-4 -translate-y-0.5" /> Ready to send.
                        </span>{' '}
                        A live link that works the moment the build finishes.
                    </p>

                    <p className="text-muted-foreground text-balance">
                        <span className="text-foreground font-medium">
                            <FolderTree className="inline size-4 -translate-y-0.5" /> Their branding.
                        </span>{' '}
                        Name, services, and location, not lorem ipsum.
                    </p>

                    <p className="text-muted-foreground text-balance">
                        <span className="text-foreground font-medium">
                            <Share2 className="inline size-4 -translate-y-0.5" /> Edit on the call.
                        </span>{' '}
                        Change the colour or the headline while they watch.
                    </p>

                    <p className="text-muted-foreground text-balance">
                        <span className="text-foreground font-medium">
                            <Layers className="inline size-4 -translate-y-0.5" /> Yours to hand over.
                        </span>{' '}
                        Full source code goes to the client when they pay.
                    </p>
                </div>
            </div>
        </section>
    )
}
