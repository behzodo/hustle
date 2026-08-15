import Link from 'next/link'
import { LogoIcon } from '@/components/logo'
import { SignUpCta } from '@/components/auth-cta'
import { appUrl } from '@/lib/site'

const footerLinks = [
    {
        name: 'Product',
        links: [
            { href: '#how-it-works', label: 'How it works' },
            { href: '#features', label: 'Features' },
            { href: '#pricing', label: 'Pricing' },
        ],
    },
    {
        name: 'Start',
        links: [
            { href: appUrl('/sign-up'), label: 'Create an account' },
            { href: appUrl('/sign-in'), label: 'Log in' },
            { href: appUrl('/pricing'), label: 'Plans and credits' },
        ],
    },
    {
        name: 'Legal',
        links: [
            { href: '/privacy', label: 'Privacy Policy' },
            { href: '/terms', label: 'Terms of Service' },
        ],
    },
]

export default function Footer() {
    return (
        <footer>
            <div className="mx-auto max-w-7xl space-y-16 px-6 pb-6 pt-32">
                <div className="grid grid-cols-2 gap-x-3 gap-y-12 sm:grid-cols-4 lg:grid-cols-6">
                    <div className="col-span-full lg:col-span-3">
                        <Link
                            href="/"
                            aria-label="go home"
                        >
                            <LogoIcon uniColor />
                        </Link>
                    </div>

                    {footerLinks.map((linksGroup, index) => (
                        <div key={index}>
                            <span className="text-foreground text-sm">{linksGroup.name}</span>
                            <ul className="mt-4 list-inside space-y-4">
                                {linksGroup.links.map((link, index) => (
                                    <li key={index}>
                                        <Link
                                            href={link.href}
                                            className="hover:text-primary text-muted-foreground text-sm duration-150"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                <div className="mt-24 grid gap-x-3 gap-y-6 border-t pt-6 sm:grid-cols-2">
                    <div>
                        <p className="text-muted-foreground text-sm">2 free sites a month. No card required.</p>
                        <div className="mt-3">
                            <SignUpCta>Find my first client</SignUpCta>
                        </div>
                    </div>
                    <span className="text-muted-foreground block text-sm">&copy; Hustle 2026</span>
                </div>
            </div>
        </footer>
    )
}
