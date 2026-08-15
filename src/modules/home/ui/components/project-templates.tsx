"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { PROJECT_TEMPLATES } from "../../constants";

interface Props {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
};

const RESTING_HINT = "Pick a trade to start from, or name the business above.";

/**
 * Starting points for the prompt box, one per trade you'd pitch. A chip drops
 * ~400 characters into the input, so the row shares one line underneath that
 * says what the highlighted chip will actually write — one calm status line
 * rather than eight tooltips.
 */
export const ProjectTemplates = ({ onSelect, disabled }: Props) => {
  const [active, setActive] = useState<string | null>(null);

  const summary =
    PROJECT_TEMPLATES.find((template) => template.label === active)?.summary;

  return (
    <div className="w-full max-w-3xl">
      {/* Scrolls as one strip on phones, where there isn't room to wrap and
          the old row was hidden outright. */}
      <div
        className={cn(
          "flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:flex-wrap md:justify-center md:overflow-visible md:pb-0"
        )}
        onMouseLeave={() => setActive(null)}
      >
        {PROJECT_TEMPLATES.map((template) => (
          <button
            key={template.label}
            type="button"
            disabled={disabled}
            title={template.summary}
            onClick={() => onSelect(template.prompt)}
            onMouseEnter={() => setActive(template.label)}
            onFocus={() => setActive(template.label)}
            onBlur={() => setActive(null)}
            className={cn(
              "shrink-0 rounded-full border border-border bg-transparent px-4 py-1.5",
              "text-[13px] font-medium tracking-[-0.01em] text-muted-foreground",
              "transition-[color,background-color,border-color,transform] duration-200",
              // Hover fills solid instead of tinting. In a monochrome palette
              // an inversion is the strongest signal available, and it echoes
              // the send button sitting right above the row.
              "hover:border-primary hover:bg-primary hover:text-primary-foreground",
              "focus-visible:border-primary focus-visible:bg-primary focus-visible:text-primary-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              "active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
          >
            {template.label}
          </button>
        ))}
      </div>

      {/* Height is reserved so swapping the text never nudges the row above.
          Hover-only information, so it stays off touch screens. */}
      <p
        className="mt-3 hidden h-4 text-center font-mono text-[11px] text-muted-foreground/70 md:block"
        aria-hidden="true"
      >
        {summary ?? RESTING_HINT}
      </p>
    </div>
  );
};
