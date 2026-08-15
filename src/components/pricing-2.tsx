import Link from 'next/link'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { appUrl } from '@/lib/site'
import { SignUpCta } from '@/components/auth-cta'
import { Button } from '@/components/ui/landing-button'
import { getPlans, formatPrice } from '@/lib/clerk-plans'

export default async function Pricing() {
    const plans = await getPlans()

    if (plans.length === 0) {
        return (
            <section
                id="pricing"
                className="py-16 md:py-20">
                <div className="mx-auto max-w-7xl px-6">
                    <h2 className="text-muted-foreground max-w-md text-balance text-4xl font-medium tracking-tight lg:text-5xl">
                        <span className="text-foreground">Start free.</span> <br /> Pay by the pitch.
                    </h2>
                    <Button
                        className="mt-8"
                        nativeButton={false}
                        render={<Link href={appUrl('/pricing')}>See plans</Link>}
                    />
                </div>
            </section>
        )
    }

    return (
        <section
            id="pricing"
            className="py-16 md:py-20">
            <div className="mx-auto max-w-7xl px-6">
                <div className="max-w-md space-y-6">
                    <p className="eyebrow text-primary font-medium">Pricing</p>
                    <h2 className="headline-display font-display text-muted-foreground text-balance text-4xl leading-[1.02] tracking-[-0.02em] lg:text-5xl">
                        <span className="text-foreground">Start free.</span> <br /> Pay by the{' '}
                        <span className="headline-figure italic text-primary">pitch</span>.
                    </h2>
                    <p className="text-muted-foreground text-lg">One credit builds one site for one prospect. Land a single client and the plan has paid for itself many times over.</p>
                </div>

                <div className="mt-12 grid gap-6 border *:p-8 max-lg:mx-auto max-lg:max-w-sm lg:mt-20 lg:grid-cols-3">
                    {plans.map((plan, index) => {
                        // The middle tier is the one most people should land on.
                        const isFeatured = plans.length === 3 && index === 1
                        const isFree = plan.amount === 0

                        return (
                            <div
                                key={plan.id}
                                className={cn(
                                    'flex flex-col gap-8',
                                    isFeatured
                                        ? 'bg-card relative shadow-xl max-lg:border-y lg:border-x'
                                        : index === 0
                                          ? 'max-lg:border-b lg:border-r'
                                          : 'max-lg:border-t lg:border-l'
                                )}>
                                {isFeatured && (
                                    <div className="inset-ring inset-ring-foreground/10 absolute right-0 top-0 w-fit -translate-y-px translate-x-px rounded-bl bg-foreground/10 px-3 py-1 text-xs font-medium text-foreground [corner-shape:bevel]">Most popular</div>
                                )}

                                <div>
                                    <p className="text-lg font-medium">{plan.name}</p>
                                    <p className="text-muted-foreground text-balance text-lg font-medium">{plan.description}</p>

                                    <div className="my-8 block text-4xl font-medium tracking-tight">
                                        {formatPrice(plan.amount, plan.currency)} <span className="text-muted-foreground text-lg">/mo</span>
                                    </div>

                                    {/* The free tier is just an account, so it opens the sign-up
                                        modal. Paid tiers need Clerk's checkout, which lives on
                                        the workspace's own pricing page. */}
                                    {isFree ? (
                                        <SignUpCta
                                            className="w-full"
                                            variant={isFeatured ? 'default' : 'outline'}
                                        >
                                            Start free
                                        </SignUpCta>
                                    ) : (
                                        <Button
                                            className="w-full"
                                            variant={isFeatured ? 'default' : 'outline'}
                                            nativeButton={false}
                                            render={
                                                <Link href={appUrl('/pricing')}>
                                                    {plan.freeTrialDays ? `Try ${plan.freeTrialDays} days free` : `Get ${plan.name}`}
                                                </Link>
                                            }
                                        />
                                    )}

                                    {plan.annualMonthlyAmount > 0 && plan.annualMonthlyAmount < plan.amount && (
                                        <p className="text-muted-foreground mt-3 text-center text-xs">{formatPrice(plan.annualMonthlyAmount, plan.currency)}/mo billed annually</p>
                                    )}
                                </div>

                                <ul className="text-muted-foreground list-outside space-y-3">
                                    {plan.features.map((feature) => (
                                        <li
                                            key={feature.slug}
                                            className="flex items-center gap-3">
                                            <Check className="text-muted-foreground size-3 shrink-0" />
                                            {feature.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
