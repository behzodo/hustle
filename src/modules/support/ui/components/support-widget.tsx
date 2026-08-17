"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowSquareOutIcon,
  ChatCircleDotsIcon,
  XIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { MetallicLogo } from "@/components/metallic-logo";
import { SupportChat } from "./support-chat";

/**
 * The floating helper, mounted once by the workspace shell.
 *
 * Deliberately not a route: the whole value of a widget is answering without
 * making someone leave the screen they are stuck on.
 */
export const SupportWidget = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          // origin-bottom-right + scale: the panel grows out of the button it
          // was summoned from, rather than appearing somewhere near it.
          "bg-background/95 fixed right-4 bottom-20 z-50 flex h-[30rem] w-[23rem] max-w-[calc(100vw-2rem)] origin-bottom-right flex-col overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl transition-all duration-200 ease-out",
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0",
        )}
      >
        {/* Header. The mark plus a live dot — the two things that say a real
            thing is on the other end. */}
        <div className="from-muted/70 flex items-center gap-3 border-b bg-gradient-to-b to-transparent px-4 py-3">
          <div className="relative shrink-0">
            <MetallicLogo size={30} />
            <span className="border-background absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 bg-emerald-500" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-display headline-display text-[15px] leading-tight tracking-[-0.02em]">
              Hustle support
            </p>
            <p className="text-muted-foreground text-xs">Replies instantly</p>
          </div>

          <Link
            href="/support"
            aria-label="Open the full support page"
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1.5 transition-colors"
          >
            <ArrowSquareOutIcon className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close support"
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg p-1.5 transition-colors"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <SupportChat className="flex-1" />
      </div>

      {/* The plate clips its own overflow so the sheen stays inside the disc,
          which means the ping cannot live in the button — it rings from a
          wrapper sitting directly behind it instead. The wrapper also carries
          the drop shadow, since the plate owns the button's own box-shadow. */}
      <div className="fixed right-4 bottom-4 z-50 rounded-full shadow-xl">
        {!open && (
          <span className="bg-foreground/25 pointer-events-none absolute inset-0 animate-ping rounded-full [animation-duration:3s]" />
        )}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close support" : "Open support"}
          className="metal-plate group relative flex size-13 items-center justify-center rounded-full transition-transform duration-300 hover:scale-105 active:scale-95"
        >
          {/* One icon rotates out as the other rotates in, so the button reads
              as a single control changing state rather than two buttons. Both
              sit above the sheen, which is painted at z-index 1. */}
          <ChatCircleDotsIcon
            className={cn(
              "absolute z-[2] size-5 transition-all duration-300",
              open ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0",
            )}
            weight="fill"
          />
          <XIcon
            className={cn(
              "absolute z-[2] size-5 transition-all duration-300",
              open ? "scale-100 rotate-0" : "scale-0 -rotate-90 opacity-0",
            )}
            weight="bold"
          />
        </button>
      </div>
    </>
  );
};
