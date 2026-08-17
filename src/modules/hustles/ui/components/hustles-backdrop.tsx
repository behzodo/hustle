"use client";

import { FaultyTerminal } from "@/components/ui/faulty-terminal";
import { useMounted } from "@/hooks/use-mounted";
import { useCurrentTheme } from "@/hooks/use-current-theme";

/**
 * The CRT wash behind the hustles grid.
 *
 * Tinted to the same neutral chrome the logo and the New hustle plate are
 * mixed from, rather than the shader's stock phosphor green — the palette has
 * no hue in it and a green terminal would be the only coloured thing in the
 * product.
 */
export const HustlesBackdrop = () => {
  const mounted = useMounted();
  const theme = useCurrentTheme();

  // The shader paints its own black; there is no light-theme version of a CRT,
  // and inverting it just gives a grey smear. Light keeps the plain page.
  //
  // The mount gate is what keeps the first client render identical to the
  // server's, which has no theme to branch on. Without it this element only
  // exists on one side of hydration.
  if (!mounted || theme !== "dark") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <FaultyTerminal
        scale={1.7}
        gridMul={[2, 1]}
        digitSize={1.3}
        timeScale={0.2}
        // noiseAmp drives the whole field — at the registry's default of 0 the
        // pattern collapses and the canvas renders solid black.
        noiseAmp={1}
        scanlineIntensity={0.4}
        glitchAmount={1}
        flickerAmount={0.5}
        curvature={0.1}
        chromaticAberration={0}
        brightness={0.42}
        tint="#c9ccd2"
        // Off on purpose: content covers the middle of the page, so the ripple
        // would only ever answer the cursor out in the margins.
        mouseReact={false}
      />

      {/* Strongest behind the headline, gone by the foot of the grid — the
          glyphs are texture for the top of the page, not a backdrop for
          reading card titles against. */}
      <div className="from-background/55 via-background/85 to-background absolute inset-0 bg-gradient-to-b" />
    </div>
  );
};
