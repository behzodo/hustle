"use client";

import { Dither } from "@/components/ui/dither";
import { useMounted } from "@/hooks/use-mounted";
import { useCurrentTheme } from "@/hooks/use-current-theme";

/**
 * The dithered field behind an empty hustle.
 *
 * The wave colour is a flat grey rather than a tint: the shader mixes up from
 * black toward it, so any hue here would be the only colour on the screen.
 */
export const ProjectBackdrop = () => {
  const mounted = useMounted();
  const theme = useCurrentTheme();

  // The shader paints its own black — there is no light version of this. The
  // mount gate keeps the first client render identical to the server's, which
  // has no theme to branch on.
  if (!mounted || theme !== "dark") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <Dither
        waveSpeed={0.022}
        waveFrequency={2.6}
        waveAmplitude={0.28}
        waveColor={[0.46, 0.47, 0.5]}
        colorNum={4}
        pixelSize={2.5}
        // The pointer plate would have to sit above the composer and the
        // browser mock to catch anything, and this is a screen you type on.
        enableMouseInteraction={false}
      />

      {/* Heavy: the bands are a texture for the edges of the screen, not a
          surface to read the mock and the caption against. */}
      <div className="from-background/75 via-background/88 to-background absolute inset-0 bg-gradient-to-b" />
    </div>
  );
};
