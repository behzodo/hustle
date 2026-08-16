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

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close support" : "Open support"}
        className="bg-primary text-primary-foreground group fixed right-4 bottom-4 z-50 flex size-13 items-center justify-center rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
      >
        {/* One icon rotates out as the other rotates in, so the button reads
            as a single control changing state rather than two buttons. */}
        <ChatCircleDotsIcon
          className={cn(
            "absolute size-5 transition-all duration-300",
            open ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0",
          )}
          weight="fill"
        />
        <XIcon
          className={cn(
            "absolute size-5 transition-all duration-300",
            open ? "scale-100 rotate-0" : "scale-0 -rotate-90 opacity-0",
          )}
          weight="bold"
        />

        {/* A single ping while closed, to say the helper is there. */}
        {!open && (
          <span className="bg-primary/30 absolute inset-0 animate-ping rounded-full [animation-duration:3s]" />
        )}
      </button>
    </>
  );
};
