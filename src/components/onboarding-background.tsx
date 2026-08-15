"use client";

import LightTunnel from "@/components/LightTunnel";
import { useMedia } from "@/hooks/use-media";

// Onboarding only. It is the one screen with no product chrome to compete
// with, and the only one a user sees exactly once — everywhere else this
// would be a WebGL context running for the whole session.
export const OnboardingBackground = () => {
  // useMedia starts true, so motion stays off until the query resolves —
  // the safe way round for anyone who asked for reduced motion.
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <LightTunnel
        // Retinted from the shipped purple to the brand terracotta.
        cableColor="#d97757"
        pulseColor="#f0b49a"
        tunnelColor="#c96442"
        speed={reducedMotion ? 0 : 0.06}
        pulseSpeed={reducedMotion ? 0 : 1.4}
        cableCount={18}
        thickness={0.3}
        glow={0.9}
        brightness={0.85}
        opacity={0.65}
        mouseInteraction={!reducedMotion}
        mouseStrength={0.06}
      />
      {/* Scrim: the tunnel converges dead centre, which is exactly where the
          wizard's text sits. Without this the labels lose contrast. */}
      <div className="from-background via-background/70 to-background/40 absolute inset-0 bg-gradient-to-b" />
    </div>
  );
};
