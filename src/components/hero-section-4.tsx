import { HeroHeader } from '@/components/hero-section-4-header'

import Link from 'next/link'
import { SignUpCta } from '@/components/auth-cta'
import { HeroGlobe } from '@/components/hero-globe'
import { Button } from '@/components/ui/landing-button'

export default function HeroSection() {
    return (
        <>
            <HeroHeader />
            <main className="@container overflow-x-hidden">
                {/* Fills the viewport below the fixed header so the hero owns
                    the first screen instead of sitting in its top third. */}
                <section className="flex min-h-[calc(100svh-5rem)] items-center">
                    <div className="w-full pb-16 pt-32 lg:pt-24">
                        <div className="relative mx-auto grid max-w-7xl items-center px-6 md:grid-cols-2 md:gap-12">
                            <div className="text-center md:text-left">
                                {/* The accent italic marks the payoff — the thing you
                                    actually get. Same rule everywhere on the page. */}
                                <h1 className="headline-display font-display mb-6 text-balance text-5xl leading-[0.95] tracking-[-0.03em] lg:text-6xl xl:text-7xl">
                                    Don&rsquo;t pitch a website.<br className="max-md:hidden" /> Show them{' '}
                                    <span className="headline-figure italic text-primary">theirs</span>.
                                </h1>
                                <p className="text-muted-foreground mb-10 text-balance text-lg lg:text-xl">Hustle finds local businesses with no website — or a bad one — then builds theirs before you ever reach out. You show up with the work already done.</p>

                                <div className="flex gap-2 max-md:justify-center">
                                    <SignUpCta>Find my first client</SignUpCta>
                                    <Button
                                        variant="ghost"
                                        className="hover:bg-transparent"
                                        nativeButton={false}
                                        render={<Link href="#pricing">See pricing</Link>}
                                    />
                                </div>

                                <p className="text-muted-foreground mt-4 text-sm">2 free sites a month. No card required.</p>
                            </div>

                            <div className="relative flex items-center justify-center max-md:mt-12">
                                <HeroGlobe />
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}
