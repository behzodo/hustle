import { SignUpCta } from '@/components/auth-cta'

export default function CallToAction() {
    return (
        <section className="py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-6">
                <div className="flex items-center justify-center gap-6 max-lg:flex-col max-lg:text-center lg:items-end lg:justify-between">
                    <h2 className="headline-display font-display max-w-4xl text-balance text-5xl leading-[1] tracking-[-0.03em] xl:text-6xl">
                        Who are you pitching{' '}
                        <span className="headline-figure italic text-primary">first</span>?
                    </h2>

                    <SignUpCta size="lg">Find my first client</SignUpCta>
                </div>
            </div>
        </section>
    )
}
