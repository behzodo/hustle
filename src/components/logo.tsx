import { cn } from '@/lib/utils'
import { MetallicLogo } from '@/components/metallic-logo'

// Matches the workspace navbar so the brand reads the same on both hosts.
export const Logo = ({ className }: { className?: string; uniColor?: boolean }) => {
    return (
        <span className={cn('flex items-center gap-2', className)}>
            <MetallicLogo size={32} priority />
            <span className="text-lg font-semibold">Hustle</span>
        </span>
    )
}

// Standalone mark, so it carries the brand name itself. Safe to paint now
// that offscreen instances release their WebGL context — this one sits below
// the fold and costs nothing until you reach it.
export const LogoIcon = ({ className }: { className?: string; uniColor?: boolean }) => {
    return <MetallicLogo size={32} label="Hustle" className={cn(className)} />
}
