"use client";

import { CalendarCheck, Check, Minus, Phone, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  HUSTLE_MODES,
  MODE_SERVICES,
  type HustleMode,
  type ServiceId,
  type Slot,
} from "../../modes";

/**
 * Picking what a hustle sells.
 *
 * A radio group rather than three buttons that look like one: the choice is
 * exclusive and arrow keys should move between the options, which is what the
 * role buys and what `aria-pressed` on three separate toggles would not.
 *
 * The three cards are deliberately identical in structure — same rows, same
 * order, same heights — because the whole decision is a comparison, and a
 * shorter card reads as a smaller option rather than a different one.
 */

const SERVICE_ICONS: Record<ServiceId, LucideIcon> = {
  phone: Phone,
  diary: CalendarCheck,
  reviews: Star,
};

/**
 * A year of income, drawn in metal.
 *
 * One pin is one month, left to right. The tall pin is the invoice for the
 * site; the short ones are the subscription; a flat line is a month this
 * business pays nothing. Decorative to a screen reader — the money line and
 * the service rows underneath say the same thing in words.
 *
 * It is the honest argument for the monthly and it takes no reading: Normal
 * spikes once and flatlines, Pro is a drumbeat, Hybrid is both.
 */
const Income = ({ slots, selected }: { slots: Slot[]; selected: boolean }) => (
  <div
    aria-hidden
    className={cn(
      "metal-run mt-5 flex h-10 items-end gap-1.5 px-0.5",
      selected && "metal-run--lit",
    )}
  >
    {slots.map((slot, index) =>
      slot === "none" ? (
        // Not a pin. Nothing was earned that month, and drawing a short piece
        // of metal for it would make an empty month look like a small one.
        <span
          key={index}
          className="bg-muted-foreground/20 h-px flex-1 rounded-full"
        />
      ) : (
        <span
          key={index}
          className={cn(
            "metal-pin flex-1 rounded-[3px] transition-[height] duration-300",
            slot === "fee" ? "h-9" : "h-3",
            selected && "metal-pin--warm",
          )}
        />
      ),
    )}
  </div>
);

interface Props {
  value: HustleMode;
  onChange: (mode: HustleMode) => void;
  disabled?: boolean;
}

export const ModePicker = ({ value, onChange, disabled }: Props) => (
  <div>
    <div
      role="radiogroup"
      aria-label="What this hustle sells"
      className="grid gap-4 md:grid-cols-3"
    >
      {HUSTLE_MODES.map((mode) => {
        const selected = value === mode.id;

        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(mode.id)}
            className={cn(
              // `milled` is the same 1px catch-light the other dark panels
              // carry, so these sit in the page as machined surfaces rather
              // than holes cut in it.
              "milled dark:bg-sidebar flex flex-col rounded-2xl border bg-white p-5 text-left transition-colors",
              "focus-visible:ring-primary/60 focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? "border-primary bg-primary/5 dark:bg-primary/10"
                : "hover:bg-muted/40",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-xl leading-tight">{mode.name}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {mode.tagline}
                </p>
              </div>

              {/* Holds its space unselected, so picking a card does not shift
                  the two next to it. */}
              <span className="mt-0.5 shrink-0">
                <Check
                  className={cn(
                    "text-primary size-4 transition-opacity",
                    selected ? "opacity-100" : "opacity-0",
                  )}
                />
              </span>
            </div>

            <Income slots={mode.slots} selected={selected} />

            <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
              {mode.blurb}
            </p>

            {/* Listed on all three, present or not. What Normal does not
                include is the argument for the other two, and a card that
                simply omitted the rows would hide it. */}
            <ul className="mt-5 space-y-2 border-t pt-4">
              {MODE_SERVICES.map((service) => {
                const Icon = SERVICE_ICONS[service.id];

                return (
                  <li
                    key={service.id}
                    className={cn(
                      "flex items-center gap-2.5 text-sm",
                      mode.monthly
                        ? "text-foreground"
                        : "text-muted-foreground/50 line-through decoration-1",
                    )}
                  >
                    {mode.monthly ? (
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          selected ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    ) : (
                      <Minus className="text-muted-foreground/40 size-4 shrink-0" />
                    )}
                    {service.label}
                  </li>
                );
              })}
            </ul>

            <p className="eyebrow text-muted-foreground/80 mt-auto pt-5 font-medium">
              {mode.money}
            </p>
          </button>
        );
      })}
    </div>

    <p className="text-muted-foreground mt-5 text-sm">
      Each pin is a month of income from one business — tall is the site, short
      is the monthly. Change this later from the hustle itself.
    </p>
  </div>
);
