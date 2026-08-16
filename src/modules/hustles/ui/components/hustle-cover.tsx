"use client";

import { cn } from "@/lib/utils";

/**
 * A miniature of the site itself, drawn in CSS.
 *
 * What the card is standing in for is a finished web page, so it shows one:
 * browser chrome, a nav, a headline, a call to action, a row of cards. Every
 * bar is a real element at real proportions, which is why it reads as a
 * website at 300px wide where an abstract gradient reads as nothing.
 *
 * On hover the page scrolls, the way a preview should when you lean in.
 */

// Three layouts, so a grid of these does not look like one file repeated.
const LAYOUTS = ["left", "center", "split"] as const;

const seedOf = (name: string) => {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 100003;
  return hash;
};

/** A block of body copy. Widths taper like a real ragged paragraph. */
const Lines = ({
  widths,
  className,
}: {
  widths: number[];
  className?: string;
}) => (
  <div className={cn("space-y-[3px]", className)}>
    {widths.map((width, i) => (
      <div
        key={i}
        className="bg-foreground/15 h-[3px] rounded-full"
        style={{ width: `${width}%` }}
      />
    ))}
  </div>
);

export const HustleCover = ({
  name,
  className,
}: {
  name: string;
  className?: string;
}) => {
  const seed = seedOf(name);
  const layout = LAYOUTS[seed % LAYOUTS.length];
  const isCenter = layout === "center";
  const isSplit = layout === "split";

  return (
    <div
      className={cn("bg-muted/60 relative overflow-hidden", className)}
      aria-hidden
    >
      {/* Browser chrome. The single strongest signal that the thing below is
          a web page and not a photograph. */}
      <div className="border-foreground/10 bg-background/80 flex h-5 items-center gap-1 border-b px-2">
        <span className="bg-foreground/20 size-[5px] rounded-full" />
        <span className="bg-foreground/20 size-[5px] rounded-full" />
        <span className="bg-foreground/20 size-[5px] rounded-full" />
        <div className="bg-foreground/10 ml-2 h-[7px] flex-1 rounded-full" />
      </div>

      {/* The page. Taller than the frame, and shifted up on hover so there is
          something underneath to scroll to. */}
      <div className="bg-background absolute inset-x-0 top-5 bottom-0 transition-transform duration-700 ease-out group-hover:-translate-y-[18%]">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="bg-foreground/70 h-[5px] w-8 rounded-full" />
          <div className="flex gap-1.5">
            <div className="bg-foreground/20 h-[4px] w-4 rounded-full" />
            <div className="bg-foreground/20 h-[4px] w-4 rounded-full" />
            <div className="bg-foreground/20 h-[4px] w-4 rounded-full" />
          </div>
        </div>

        <div
          className={cn(
            "px-3 pt-2",
            isSplit && "flex items-center gap-3",
            isCenter && "flex flex-col items-center text-center",
          )}
        >
          <div className={cn(isSplit && "flex-1", isCenter && "w-3/4")}>
            {/* Headline: two heavy bars, the weight a display serif carries
                at this size. */}
            <div
              className={cn(
                "bg-foreground/80 h-[7px] rounded-full",
                isCenter ? "mx-auto w-full" : "w-4/5",
              )}
            />
            <div
              className={cn(
                "bg-foreground/80 mt-1.5 h-[7px] rounded-full",
                isCenter ? "mx-auto w-2/3" : "w-3/5",
              )}
            />

            <Lines
              widths={isCenter ? [90, 70] : [95, 80]}
              className={cn("mt-2", isCenter && "mx-auto w-5/6")}
            />

            <div
              className={cn(
                "bg-foreground mt-2.5 h-[9px] w-12 rounded-full",
                isCenter && "mx-auto",
              )}
            />
          </div>

          {isSplit && (
            <div className="bg-foreground/10 aspect-[4/3] w-2/5 shrink-0 rounded-md" />
          )}
        </div>

        {/* The fold. Only visible once the page scrolls on hover. */}
        <div className="mt-4 grid grid-cols-3 gap-2 px-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="bg-foreground/10 aspect-[4/3] rounded-md" />
              <div className="bg-foreground/25 h-[4px] w-3/4 rounded-full" />
              <div className="bg-foreground/10 h-[3px] w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Slow sheen across the glass. Long enough to feel ambient rather than
          animated at you. */}
      <div className="cover-sheen pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
};
