import { MessagesSquare, Boxes, FileCode2, RefreshCw } from 'lucide-react'

export default function ContentSection() {
    return (
        <section
            id="how-it-works"
            className="py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-6">
                <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:gap-12">
                    <div className="max-w-md space-y-4">
                        <p className="eyebrow text-primary font-medium">How it works</p>
                        <h2 className="headline-display font-display text-balance text-4xl leading-[1.02] tracking-[-0.02em] lg:text-5xl">
                            <span className="text-muted-foreground">From cold lead.</span> <br /> To a{' '}
                            <span className="headline-figure italic text-primary">signed client</span>.
                        </h2>
                    </div>
                    <div className="space-y-4">
                        <p className="text-muted-foreground text-balance text-lg">Cold outreach fails because you are asking for imagination. A plumber cannot picture the website you are describing over the phone.</p>
                        <p className="text-muted-foreground text-balance text-lg">So Hustle builds it first. You send a link to a finished site with their name on it, and the conversation starts at "how much" instead of "no thanks".</p>

                        <div className="*:not-last:pb-3 *:not-last:border-b mt-20 flex flex-col gap-3 pt-6">
                            <p className="text-muted-foreground text-balance text-lg">
                                <span className="text-foreground font-medium">
                                    <MessagesSquare className="inline size-4 -translate-y-0.5" /> Finds the businesses.
                                </span>{' '}
                                Local trades and shops with no site, or one built in 2009.
                            </p>

                            <p className="text-muted-foreground text-balance text-lg">
                                <span className="text-foreground font-medium">
                                    <Boxes className="inline size-4 -translate-y-0.5" /> Builds the site first.
                                </span>{' '}
                                A real, working site for that specific business — before you contact them.
                            </p>

                            <p className="text-muted-foreground text-balance text-lg">
                                <span className="text-foreground font-medium">
                                    <FileCode2 className="inline size-4 -translate-y-0.5" /> Gives you the link.
                                </span>{' '}
                                Send a live URL they can open on their phone in five seconds.
                            </p>

                            <p className="text-muted-foreground text-balance text-lg">
                                <span className="text-foreground font-medium">
                                    <RefreshCw className="inline size-4 -translate-y-0.5" /> Closes on the spot.
                                </span>{' '}
                                Tweak it live on the call, then hand it over when they say yes.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
