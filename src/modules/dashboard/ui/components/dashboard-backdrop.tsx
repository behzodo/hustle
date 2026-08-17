"use client";

import { Beams } from "@/components/ui/beams";
import { useMounted } from "@/hooks/use-mounted";
import { useCurrentTheme } from "@/hooks/use-current-theme";

/**
 * Drifting light behind the dashboard.
 *
 * Fixed rather than absolute: the dashboard is long, and a backdrop pinned to
 * the document would scroll off after the first panel and leave the rest of
 * the page on flat black.
 */
export const DashboardBackdrop = () => {
  const mounted = useMounted();
  const theme = useCurrentTheme();

  // The canvas paints its own black. There is no light-theme version of this,
  // so the light palette keeps the plain page.
  //
  // Gated on mount as well, and not only to save a render: the server has no
  // theme to resolve and renders nothing here, so branching on the theme
  // alone puts a whole element into the first client pass that is missing
  // from the server HTML — a hydration mismatch that reshuffles the tree.
  if (!mounted || theme !== "dark") return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <Beams
        beamNumber={14}
        beamWidth={2.4}
        beamHeight={18}
        speed={1.1}
        noiseIntensity={1.4}
        scale={0.16}
        rotation={26}
        // Untinted, like the logo's chrome — a coloured key light would be the
        // only hue in the product.
        lightColor="#eceef2"
      />

      {/* The dashboard is dense with charts and figures; the beams are there
          to give the page a floor, not to be read through. */}
      <div className="bg-background/80 absolute inset-0" />
    </div>
  );
};
