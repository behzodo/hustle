'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import MetallicPaint from '@/components/MetallicPaint'

interface Props {
    /** Rendered size in px. The shader needs room to read — below ~28px the
     *  highlights collapse and it just looks like a smudged mark. */
    size?: number
    className?: string
    /** Set when the mark stands alone; omit when a "Hustle" wordmark sits next
     *  to it and already names the brand. */
    label?: string
    priority?: boolean
}

export const MetallicLogo = ({ size = 32, className, label, priority }: Props) => {
    const hostRef = useRef<HTMLSpanElement>(null)

    // Two gates, both required before the shader mounts.
    //
    // 1. Can this browser run it, and does the visitor want motion at all.
    // 2. Is the mark actually on screen. Each instance holds its own WebGL2
    //    context and an open requestAnimationFrame loop, and browsers cap
    //    live contexts somewhere around 16 — past that they start dropping
    //    the oldest one, which would blank a logo elsewhere on the page.
    //    Unmounting offscreen instances returns the context and stops the
    //    loop, so the footer mark costs nothing until you scroll to it.
    const [supported, setSupported] = useState(false)
    const [onScreen, setOnScreen] = useState(false)

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        const probe = document.createElement('canvas')
        if (!probe.getContext('webgl2')) return

        setSupported(true)
    }, [])

    useEffect(() => {
        const node = hostRef.current
        if (!supported || !node) return

        const observer = new IntersectionObserver(
            ([entry]) => setOnScreen(entry.isIntersecting),
            // Start a little early so it has painted by the time it's read.
            { rootMargin: '150px' }
        )

        observer.observe(node)
        return () => observer.disconnect()
    }, [supported])

    return (
        <span
            ref={hostRef}
            className={cn('relative block shrink-0', className)}
            style={{ width: size, height: size }}
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
        >
            {supported && onScreen ? (
                <MetallicPaint
                    imageSrc="/brand/logo-mark.svg"
                    // Untinted chrome. Feeding it the brand primary would
                    // just paint the mark near-black and lose the metal.
                    tintColor="#d6d6d6"
                    lightColor="#ffffff"
                    darkColor="#0a0a0a"
                    speed={0.22}
                    liquid={0.6}
                    scale={3}
                    brightness={2.1}
                    contrast={0.55}
                    fresnel={1.2}
                />
            ) : (
                <Image
                    src="/logo.svg"
                    alt=""
                    width={size}
                    height={size}
                    priority={priority}
                />
            )}
        </span>
    )
}
