"use client";

import { Silk } from "@/components/ui/silk";
import { useCurrentTheme } from "@/hooks/use-current-theme";

/**
 * Full-bleed woven backdrop for a page, plus the wash that keeps copy on top
 * of it readable.
 *
 * Split out from the pages that use it because the shader has to be told which
 * way the palette is facing, and that is a client-only question — this is the
 * boundary, so the views themselves stay server components.
 */
export const SilkBackdrop = () => {
  const theme = useCurrentTheme();

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <Silk
        speed={3}
        scale={1.3}
        rotation={0.12}
        noiseIntensity={1.2}
        // The shader multiplies this by a 0.2–1.0 pattern, so the value given
        // here is the weave's brightest thread rather than its average.
        color={theme === "light" ? "#ded8d2" : "#4f4741"}
      />
      <div className="from-background/50 via-background/75 to-background absolute inset-0 bg-gradient-to-b" />
    </div>
  );
};
