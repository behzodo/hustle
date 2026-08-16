"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { useCurrentTheme } from "@/hooks/use-current-theme";

import { formatDiameter, formatRadius, type HustleArea } from "../../area";
import { staticMapUrl } from "../../static-map";

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-6 py-3">
    <span className="eyebrow text-muted-foreground shrink-0 font-medium">
      {label}
    </span>
    <span className="font-display truncate text-right text-base tabular-nums">
      {value}
    </span>
  </div>
);

interface Props {
  name: string;
  area: HustleArea;
  /** Jump back to the step that set a given field. */
  onEdit: (step: number) => void;
  disabled?: boolean;
}

export const HustleSummary = ({ name, area, onEdit, disabled }: Props) => {
  const theme = useCurrentTheme();
  const [artFailed, setArtFailed] = useState(false);

  const art = staticMapUrl(area, { theme: theme === "dark" ? "dark" : "light" });

  const showArt = art && !artFailed;

  return (
    // Side by side once there is room: stacked, the picture and the rows
    // together are taller than the screen and the step opens half-scrolled.
    <div
      className={cn(
        "dark:bg-sidebar overflow-hidden rounded-2xl border bg-white",
        showArt && "md:grid md:grid-cols-2 md:items-stretch",
      )}
    >
      {showArt && (
        <div className="bg-muted relative border-b md:border-r md:border-b-0">
          {/* A plain img, not next/image: the URL is generated per area, so
              there is nothing to optimise ahead of time and the loader would
              only add a hop. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={art}
            alt={`Map of ${area.label}`}
            className="h-56 w-full object-cover md:absolute md:inset-0 md:h-full"
            onError={() => setArtFailed(true)}
          />
        </div>
      )}

      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-muted-foreground font-medium">Hustle</p>
            <p className="font-display mt-1.5 truncate text-2xl leading-tight">
              {name}
            </p>
          </div>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onEdit(0)}
            className={cn(
              "text-muted-foreground hover:text-foreground shrink-0 text-sm underline underline-offset-4",
              "transition-colors disabled:opacity-50",
            )}
          >
            Rename
          </button>
        </div>

        <div className="mt-5 divide-y border-t">
          <Row label="Patch" value={area.label} />
          <Row label="Across" value={formatDiameter(area.radiusM)} />
          <Row
            label="Shape"
            value={
              area.polygon
                ? `Traced, ${area.polygon.length} points`
                : `Circle, ${formatRadius(area.radiusM)} radius`
            }
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Change any of this later from the hustle itself.
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onEdit(1)}
            className={cn(
              "text-muted-foreground hover:text-foreground shrink-0 text-sm underline underline-offset-4",
              "transition-colors disabled:opacity-50",
            )}
          >
            Edit patch
          </button>
        </div>
      </div>
    </div>
  );
};
