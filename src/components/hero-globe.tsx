'use client'

import type { COBEOptions } from 'cobe'

import { Globe } from '@/components/ui/globe'
import { useCurrentTheme } from '@/hooks/use-current-theme'

// Markers invert with the theme so they stay the highest-contrast thing on
// the sphere: near-black on the light globe, white on the dark one.
const INK: [number, number, number] = [0.07, 0.07, 0.07]
const CHALK: [number, number, number] = [1, 1, 1]

const MARKERS = [
    { location: [37.7595, -122.4367] as [number, number], size: 0.06 },
    { location: [40.7128, -74.006] as [number, number], size: 0.08 },
    { location: [51.5074, -0.1278] as [number, number], size: 0.06 },
    { location: [52.52, 13.405] as [number, number], size: 0.05 },
    { location: [41.3111, 69.2797] as [number, number], size: 0.06 },
    { location: [19.076, 72.8777] as [number, number], size: 0.07 },
    { location: [1.3521, 103.8198] as [number, number], size: 0.05 },
    { location: [35.6762, 139.6503] as [number, number], size: 0.06 },
    { location: [-23.5505, -46.6333] as [number, number], size: 0.06 },
    { location: [-33.8688, 151.2093] as [number, number], size: 0.05 },
]

const BASE: Omit<COBEOptions, 'dark' | 'baseColor' | 'glowColor' | 'mapBrightness' | 'diffuse' | 'markerColor'> = {
    width: 800,
    height: 800,
    onRender: () => {},
    devicePixelRatio: 2,
    phi: 0,
    theta: 0.25,
    mapSamples: 16000,
    markers: MARKERS,
}

// The shipped defaults render a near-white sphere with a bright halo, which
// blows out against the dark theme. Each theme gets its own surface values.
const LIGHT: COBEOptions = {
    ...BASE,
    dark: 0,
    diffuse: 0.4,
    mapBrightness: 1.2,
    markerColor: INK,
    baseColor: [1, 1, 1],
    glowColor: [1, 1, 1],
}

const DARK: COBEOptions = {
    ...BASE,
    dark: 1,
    diffuse: 1.1,
    mapBrightness: 6,
    markerColor: CHALK,
    // Must sit clearly lighter than the page background (#1f1f1f) or the
    // sphere reads as a black hole with no edge.
    baseColor: [0.42, 0.42, 0.42],
    glowColor: [0.2, 0.2, 0.2],
}

export const HeroGlobe = () => {
    const theme = useCurrentTheme()

    return (
        // Half-height frame crops the sphere at its equator so only the top
        // hemisphere shows. The mask fades the cut line out instead of
        // leaving a hard horizontal edge across the sphere.
        // Allowed to spill past the column on wide screens so the sphere
        // reads at hero scale rather than as an inset illustration.
        <div className="relative mx-auto aspect-[2/1] w-full max-w-none overflow-hidden md:w-[190%] lg:w-[220%] xl:w-[245%] [mask-image:linear-gradient(to_bottom,black_55%,transparent_98%)]">
            <Globe
                className="!max-w-none"
                config={theme === 'dark' ? DARK : LIGHT}
            />
        </div>
    )
}
