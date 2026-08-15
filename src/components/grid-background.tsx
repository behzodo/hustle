"use client";

import { useEffect, useState } from "react";

import { useCurrentTheme } from "@/hooks/use-current-theme";
import { FlickeringGrid } from "@/components/ui/flickering-grid";

// The static grid this replaces sat on a 16px pitch. Keeping that rhythm
// (3px square + 13px gap) means only the flicker is new — the page doesn't
// suddenly change its underlying grain.
const SQUARE_SIZE = 3;
const GRID_GAP = 13;

// Squares are drawn at a random opacity up to this ceiling, so the values
// below land near the old #333 / #e2e2e2 dots once composited on the page.
const THEME = {
  dark: { color: "#ffffff", maxOpacity: 0.16 },
  light: { color: "#000000", maxOpacity: 0.1 },
} as const;

export const GridBackground = () => {
  const theme = useCurrentTheme();
  const [reducedMotion, setReducedMotion] = useState(false);

  // A full-viewport canvas repainting every frame is exactly what someone
  // asking for reduced motion wants stopped. flickerChance 0 leaves the grid
  // drawn but static.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const { color, maxOpacity } = theme === "dark" ? THEME.dark : THEME.light;

  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 bg-background">
      <FlickeringGrid
        // Remounting on theme change resets the canvas to the new colour
        // instead of leaving already-drawn squares in the old one.
        key={theme}
        squareSize={SQUARE_SIZE}
        gridGap={GRID_GAP}
        color={color}
        maxOpacity={maxOpacity}
        flickerChance={reducedMotion ? 0 : 0.28}
      />
    </div>
  );
};
