"use client";

import { useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  ArrowUpRightIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { useMedia } from "@/hooks/use-media";
import { describeGap, type WebPresence } from "@/modules/hustles/discovery/lead";

/**
 * One business, on a card you turn over.
 *
 * The businesses on this screen arrived by being filed — the lead wall throws
 * them into the rail when it is done with them — so what you find in the
 * drawer afterwards is an index card, at an index card's proportions, with a
 * front you read at a glance and a record on the back.
 *
 * That is also why it turns rather than expanding or opening a panel. A card
 * has two sides and only one of them can face you, which is exactly the
 * relationship between the two halves of this content: the front is for
 * deciding whether to call, the back is what you need once you have decided.
 * An expanding card would let you have both, and having both is what makes a
 * grid of forty of these unreadable.
 *
 * The back is the card reversed — dark plate, mono type, labelled rows. Not
 * decoration: it is a different kind of reading, and printing it on the same
 * white face as the name would make the turn feel like a transition rather
 * than the other side of something.
 */

export interface CardLead {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  presence: WebPresence;
  socialKind?: string;
  rating?: number;
  reviewCount?: number;
  categories: string[];
  photo?: string;
  score: number;
  term: string;
  lat: number;
  lng: number;
  placeId: string;
}

/**
 * The listing on Google's own map.
 *
 * Built from the stored point and place id rather than a saved URL — the id is
 * what makes it open the right listing instead of a search that happens to
 * find it.
 */
const mapsUrl = (lead: CardLead) =>
  `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lng}&query_place_id=${encodeURIComponent(lead.placeId)}`;

/** One labelled row of the record. */
const Row = ({
  label,
  children,
  missing,
}: {
  label: string;
  children: React.ReactNode;
  /** Nothing was recorded — said plainly rather than left blank. */
  missing?: boolean;
}) => (
  <div className="grid grid-cols-[4.5rem_1fr] items-baseline gap-2">
    <dt className="font-mono text-[10px] tracking-wide opacity-50">{label}</dt>
    <dd
      className={cn(
        "min-w-0 truncate font-mono text-[11px] tabular-nums",
        missing && "opacity-35",
      )}
    >
      {children}
    </dd>
  </div>
);

export const LeadCard = ({
  lead,
  hustleName,
}: {
  lead: CardLead;
  /** The patch it came out of. Only worth showing across several hustles. */
  hustleName?: string;
}) => {
  const still = Boolean(useReducedMotion());
  // A touch screen has no hover to flip on, so there the card is tapped. Asked
  // of the device rather than the width: a laptop at a narrow window still
  // has a pointer.
  const canHover = useMedia("(hover: hover)");

  const [flipped, setFlipped] = useState(false);

  // Google's thumbnail URLs carry a token and do eventually stop resolving, so
  // a photo is something that might not arrive. When it does not, the card
  // falls back to the plain face rather than framing a broken image.
  const [broken, setBroken] = useState(false);
  const photo = broken ? undefined : lead.photo;

  const gap = describeGap(lead.presence, lead.socialKind);

  return (
    <div
      className="group [perspective:1200px]"
      onMouseEnter={canHover ? () => setFlipped(true) : undefined}
      onMouseLeave={canHover ? () => setFlipped(false) : undefined}
      // Focus and blur bubble, so this turns the card for anyone arriving by
      // keyboard — and the containment check keeps it turned while they tab
      // through the links on the back.
      onFocus={() => setFlipped(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setFlipped(false);
        }
      }}
    >
      <div
        className={cn(
          "relative aspect-[7/5] w-full",
          still
            ? "transition-opacity duration-200"
            : "transition-transform duration-500 [transform-style:preserve-3d] ease-[cubic-bezier(0.4,0,0.2,1)]",
          !still && flipped && "[transform:rotateY(180deg)]",
        )}
      >
        {/* --- Front: is this one worth an hour? --------------------------- */}
        <button
          type="button"
          onClick={() => setFlipped((open) => !open)}
          aria-expanded={flipped}
          aria-label={`${lead.name} — ${gap}. Show contact details`}
          className={cn(
            "focus-visible:ring-ring absolute inset-0 flex w-full flex-col items-start overflow-hidden rounded-2xl border p-5 text-left outline-none focus-visible:ring-2",
            photo ? "bg-muted" : "bg-card",
            // The ones with nothing at all are the cleanest pitch, so they
            // carry the heavier edge — the same rule as the lead wall.
            lead.presence === "none" ? "border-foreground/25" : "border-border",
            still
              ? flipped && "pointer-events-none opacity-0"
              : "[backface-visibility:hidden]",
          )}
        >
          {/* The shopfront, full bleed.

              This app is deliberately monochrome everywhere else — brushed
              metal, no hue. The photograph is the one place the world outside
              it is allowed in, and that is the right place for it: the whole
              screen is a list of real premises on real streets, and a name in
              a box is the version of that you can scroll past without seeing.

              Not next/image: these arrive from Google's CDN already at
              thumbnail size, and putting a hundred and twenty of them through
              the optimiser would buy nothing but latency. */}
          {photo && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo}
                alt=""
                aria-hidden
                loading="lazy"
                decoding="async"
                // Google's CDN is selective about who it serves on a referrer.
                referrerPolicy="no-referrer"
                onError={() => setBroken(true)}
                className="absolute inset-0 size-full object-cover"
              />
              {/* Strong enough at the base to carry text over any photograph,
                  and clear at the top so the picture is still a picture. */}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/55 to-black/15"
              />
            </>
          )}

          <div className="relative flex w-full items-baseline justify-between gap-3">
            <span
              className={cn(
                "truncate font-mono text-[10px] tracking-wide",
                photo ? "text-white/75" : "text-muted-foreground",
              )}
            >
              {hustleName ?? lead.categories[0] ?? "—"}
            </span>
            <span
              className={cn(
                "shrink-0 font-mono text-[10px] tabular-nums",
                photo ? "text-white/75" : "text-muted-foreground",
              )}
            >
              {lead.score}
            </span>
          </div>

          <h3
            className={cn(
              "font-display relative mt-3 line-clamp-2 text-lg leading-[1.15] tracking-[-0.02em] text-balance",
              photo && "text-white",
            )}
          >
            {lead.name}
          </h3>

          <p
            className={cn(
              "relative mt-1 truncate text-xs",
              photo ? "text-white/70" : "text-muted-foreground",
            )}
          >
            {lead.categories[0] ?? lead.address ?? "—"}
          </p>

          {/* The gap is the reason the card exists, so it sits on the base
              line where the eye finishes rather than tucked under the name.
              Over a photo it takes fixed colours rather than the theme's: the
              scrim under it is always dark, whichever theme is on. */}
          <span
            className={cn(
              "relative mt-auto inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px]",
              photo
                ? lead.presence === "none"
                  ? "bg-white text-black"
                  : "bg-white/15 text-white backdrop-blur-sm"
                : lead.presence === "none"
                  ? "bg-foreground text-background"
                  : "bg-foreground/8 text-foreground",
            )}
          >
            {gap}
          </span>
        </button>

        {/* --- Back: what you need once you have decided ------------------- */}
        <div
          // Hidden faces still hold their links in the tab order; without this
          // a keyboard lands on "Open in Maps" for a card that is face down.
          inert={!flipped}
          className={cn(
            "bg-foreground text-background absolute inset-0 flex flex-col rounded-2xl p-5",
            still
              ? !flipped && "pointer-events-none opacity-0"
              : "[backface-visibility:hidden] [transform:rotateY(180deg)]",
          )}
        >
          <p className="truncate text-[13px] font-medium">{lead.name}</p>

          <dl className="mt-3 space-y-1.5">
            <Row label="rating" missing={lead.rating === undefined}>
              {lead.rating === undefined ? (
                "no reviews"
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <StarIcon className="size-3 shrink-0" weight="fill" />
                  {lead.rating.toFixed(1)}
                  <span className="opacity-60">({lead.reviewCount ?? 0})</span>
                </span>
              )}
            </Row>

            <Row label="phone" missing={lead.phone === undefined}>
              {lead.phone ?? "not listed"}
            </Row>

            <Row label="address" missing={lead.address === undefined}>
              {lead.address ?? "not listed"}
            </Row>

            {/* Which search turned it up. A surprising business on the list is
                explainable rather than suspect. */}
            <Row label="found via">{lead.term}</Row>
          </dl>

          <div className="mt-auto flex items-center gap-4 pt-3">
            <a
              href={mapsUrl(lead)}
              target="_blank"
              rel="noreferrer noopener"
              className="focus-visible:ring-background inline-flex items-center gap-1.5 rounded-sm font-mono text-[11px] underline-offset-4 outline-none hover:underline focus-visible:ring-2"
            >
              <MapPinIcon className="size-3.5" />
              Maps
              <ArrowUpRightIcon className="size-3 opacity-60" />
            </a>

            {lead.phone && (
              <a
                href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
                className="focus-visible:ring-background inline-flex items-center gap-1.5 rounded-sm font-mono text-[11px] underline-offset-4 outline-none hover:underline focus-visible:ring-2"
              >
                <PhoneIcon className="size-3.5" />
                Call
              </a>
            )}

            {/* Whatever they settled for instead of a site — the thing the
                pitch is going to talk them out of. */}
            {lead.website && (
              <a
                href={lead.website}
                target="_blank"
                rel="noreferrer noopener"
                className="focus-visible:ring-background ml-auto inline-flex items-center gap-1.5 rounded-sm font-mono text-[11px] underline-offset-4 outline-none hover:underline focus-visible:ring-2"
              >
                Their page
                <ArrowUpRightIcon className="size-3 opacity-60" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
