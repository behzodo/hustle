import { cn } from "@/lib/utils";

/**
 * The one card treatment the whole dashboard is built from.
 *
 * Matches <ProjectsList /> — same radius, border and dark surface — so the
 * dashboard reads as the same product as the workspace rather than a bolted-on
 * template. Exported as a string too, for the tiles that need to be an <a>
 * rather than a <section>.
 */
// rounded-2xl rather than the xl the rest of the app uses: these panels are
// much larger than a button or an input, and radius has to grow with the box
// or big cards read as square.
export const PANEL_CLASS =
  "bg-white dark:bg-sidebar flex flex-col rounded-2xl border";

export const Panel = ({
  className,
  ...props
}: React.ComponentProps<"section">) => (
  <section className={cn(PANEL_CLASS, className)} {...props} />
);

/** Small caps label above a figure. */
export const PanelLabel = ({
  className,
  ...props
}: React.ComponentProps<"p">) => (
  <p
    className={cn("eyebrow text-muted-foreground font-medium", className)}
    {...props}
  />
);

/**
 * Marks a panel whose numbers are invented. Deliberately legible rather than
 * subtle — the moment it reads as decoration, someone quotes the number.
 */
export const SampleBadge = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "text-muted-foreground rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase",
      className,
    )}
  >
    sample
  </span>
);
