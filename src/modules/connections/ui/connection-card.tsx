"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { MagicCard } from "@/components/ui/magic-card";

interface Props {
  logo: ReactNode;
  name: string;
  description: string;
  action: ReactNode;
  /** Dims the whole card for connections that are not live yet. */
  muted?: boolean;
};

// One shell for every connection, so a new provider is a logo and two
// strings rather than another hand-built row.
export const ConnectionCard = ({
  logo,
  name,
  description,
  action,
  muted,
}: Props) => (
  <MagicCard
    className="rounded-xl"
    // Traces the border in the brand terracotta as the cursor moves.
    gradientFrom="#d97757"
    gradientTo="#f0b49a"
    gradientColor="#2a2724"
    gradientOpacity={0.5}
    gradientSize={180}
  >
    <div
      className={cn(
        "flex items-center gap-4 p-5 transition-opacity",
        muted && "opacity-55"
      )}
    >
      {/* Brand marks sit on a light plate so they read in both themes —
          the Gmail and Stripe logos are built for light backgrounds. */}
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/95 shadow-sm ring-1 ring-black/5">
        {logo}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-medium tracking-tight">{name}</p>
        <p className="text-muted-foreground mt-0.5 text-balance text-sm leading-snug">
          {description}
        </p>
      </div>

      <div className="shrink-0">{action}</div>
    </div>
  </MagicCard>
);
