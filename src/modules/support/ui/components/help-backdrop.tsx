"use client";

import { LiquidChrome } from "@/components/ui/liquid-chrome";
import { useMounted } from "@/hooks/use-mounted";
import { useCurrentTheme } from "@/hooks/use-current-theme";

/**
 * Molten metal behind the two screens where you talk to us.
 *
 * Shared by Support and Feedback rather than given one each: they are the pair
 * at the foot of the nav, and a second shader would say they were two
 * different kinds of place. Of every backdrop in the product this is the one
 * that had to be chrome — the plate, the send arrow and the mark on these
 * pages are all milled from it. The field is that material before it set.
 */
export const HelpBackdrop = () => {
  const mounted = useMounted();
  const theme = useCurrentTheme();

  // Opaque black floor, so there is no light version. The mount gate keeps the
  // first client render identical to the server's, which has no theme to read.
  if (!mounted || theme !== "dark") return null;

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <LiquidChrome
        // Neutral: the shader divides this by a sine, so every channel gets
        // amplified together and any imbalance here comes back as a colour
        // cast across the whole screen.
        baseColor={[0.085, 0.087, 0.092]}
        speed={0.12}
        amplitude={0.32}
        frequencyX={2.6}
        frequencyY={2.6}
        // The cursor bends the metal it passes over. It only reaches the
        // margins around the panel, which is where the eye rests anyway.
        interactive
      />

      {/* The panels have to be read against this, so the metal is held well
          back — brightest at the head of the page, gone by the foot. */}
      <div className="from-background/72 via-background/88 to-background pointer-events-none absolute inset-0 bg-gradient-to-b" />
    </div>
  );
};
