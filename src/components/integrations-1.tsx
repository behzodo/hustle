import { Blocks, Box, Component, FileType2, Palette, Terminal } from 'lucide-react'

import { SignUpCta } from '@/components/auth-cta'

export default function IntegrationsSection() {
    return (
        <section>
            <div className="mx-auto max-w-7xl px-6 py-16 md:py-20">
                <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:gap-12">
                    <div className="flex flex-col justify-between gap-12 pb-6 max-lg:order-last md:mt-6">
                        <div>
                            <h2 className="headline-display font-display text-balance text-4xl leading-[1.02] tracking-[-0.02em] lg:text-5xl">
                                Built on the stack you{' '}
                                <span className="headline-figure italic text-primary">already know</span>
                            </h2>
                            <p className="text-muted-foreground mb-6 mt-4 text-balance text-lg">No page-builder lock-in. Every site is an ordinary Next.js project, so you can hand the client real code, host it anywhere, and charge for maintenance.</p>
                            <SignUpCta variant="outline">Find my first client</SignUpCta>
                        </div>

                        <p className="text-muted-foreground max-w-xs text-balance text-lg">
                            Every site is <span className="text-foreground font-medium">yours to sell</span> — components, routes, and config included.
                        </p>
                    </div>

                    <div className="mask-radial-at-top-left mask-radial-from-65% mask-radial-[100%_80%] -mx-6 px-6 sm:mx-auto sm:max-w-md md:-mx-6 md:ml-auto md:mr-0">
                        <div className="bg-card rounded-2xl border p-3 shadow-lg md:pb-12">
                            <div className="grid grid-cols-2 gap-2">
                                <Integration
                                    icon={<Box className="size-5" />}
                                    name="Next.js"
                                    description="App Router pages and layouts, ready to run."
                                />
                                <Integration
                                    icon={<Component className="size-5" />}
                                    name="React"
                                    description="Client and server components, properly split."
                                />
                                <Integration
                                    icon={<Palette className="size-5" />}
                                    name="Tailwind CSS"
                                    description="Utility styling with a consistent design scale."
                                />
                                <Integration
                                    icon={<Blocks className="size-5" />}
                                    name="shadcn/ui"
                                    description="Accessible components wired up, not stubbed."
                                />
                                <Integration
                                    icon={<FileType2 className="size-5" />}
                                    name="TypeScript"
                                    description="Typed props and state across every file."
                                />
                                <Integration
                                    icon={<Terminal className="size-5" />}
                                    name="Live sandbox"
                                    description="Dependencies installed and dev server running."
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

const Integration = ({ icon, name, description }: { icon: React.ReactNode; name: string; description: string }) => {
    return (
        <div className="hover:bg-foreground/5 space-y-4 rounded-lg border p-4 transition-colors">
            <div className="flex size-fit items-center justify-center">{icon}</div>
            <div className="space-y-1">
                <h3 className="text-sm font-medium">{name}</h3>
                <p className="text-muted-foreground line-clamp-1 text-sm md:line-clamp-2">{description}</p>
            </div>
        </div>
    )
}
