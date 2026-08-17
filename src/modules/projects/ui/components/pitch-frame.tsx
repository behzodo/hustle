"use client";

import { motion } from "motion/react";
import { CheckIcon, PaperclipIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/**
 * The last act: the finished site goes out, and comes back paid.
 *
 * Both the sender and the figure are the freelancer's own — the trading name
 * and price band collected at onboarding. The whole reason those questions
 * are asked is so the product talks in their name and their numbers, and a
 * stock "Your Agency / $1,200" here would quietly say otherwise.
 */

/** A representative figure per band slug from ONBOARDING_PRICE_BANDS. */
const BAND_FIGURES: Record<string, string> = {
  under_500: "$450",
  "500_1500": "$1,200",
  "1500_5000": "$3,000",
  over_5000: "$7,500",
};

export const figureForBand = (band?: string) =>
  (band && BAND_FIGURES[band]) || "$1,200";

/** Sent, then opened, then answered. Each one has to happen. */
const LADDER = [
  { label: "sent", at: 1.45 },
  { label: "opened", at: 1.85 },
  { label: "replied", at: 2.25 },
] as const;

interface Props {
  /** The site that was built in the previous act. */
  site: string;
  figure: string;
  /** The freelancer's trading name, from onboarding. */
  from: string;
  still: boolean;
  cycle: number;
}

export const PitchFrame = ({ site, figure, from, still, cycle }: Props) => (
  <div className="relative grid h-full place-items-center p-[4%]">
    {/* The mail going out, carrying the page that was just written. */}
    <motion.div
      key={still ? "mail" : `${cycle}-mail`}
      className="bg-card ring-foreground/10 w-full max-w-[24rem] overflow-hidden rounded-xl shadow-2xl ring-1"
      initial={still ? false : { opacity: 0, y: 16, scale: 0.95 }}
      animate={
        still
          ? { opacity: 1, y: 0, scale: 1 }
          : {
              opacity: [0, 1, 1, 0],
              y: [16, 0, 0, -90],
              scale: [0.95, 1, 1, 0.9],
              rotate: [0, 0, 0, -3],
            }
      }
      transition={{ duration: 3, times: [0, 0.16, 0.55, 1], ease: "easeInOut" }}
    >
      {/* Headers, so it reads as a message rather than a card. */}
      <div className="border-border/60 space-y-0.5 border-b px-4 py-2.5 font-mono text-[10px]">
        <p className="text-muted-foreground truncate">
          <span className="text-foreground/40">from </span>
          {from}
        </p>
        <p className="text-muted-foreground truncate">
          <span className="text-foreground/40">to </span>
          hello@{site}
        </p>
      </div>

      <div className="p-4">
        <p className="text-foreground text-sm font-medium">
          I built you a website
        </p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Had a look and you didn&rsquo;t have one, so I made a start.
          It&rsquo;s live — tell me what to change.
        </p>

        {/* A miniature of the page from the build act, so the thing being
            sent is visibly the thing that was made. */}
        <div className="bg-foreground/5 ring-foreground/10 mt-3 space-y-2 rounded-lg p-3 ring-1">
          <div className="bg-foreground/15 h-1.5 w-10 rounded-full" />
          <div className="bg-foreground/15 h-3 w-3/5 rounded" />
          <div className="flex gap-1.5">
            {[0, 1, 2].map((card) => (
              <div key={card} className="bg-foreground/10 h-6 flex-1 rounded" />
            ))}
          </div>
        </div>

        <p className="text-muted-foreground mt-2.5 flex items-center gap-1.5 font-mono text-[10px]">
          <PaperclipIcon className="size-3" />
          {site}
        </p>
      </div>
    </motion.div>

    {/* The ladder between sending and being paid. Each rung is a thing that
        actually has to happen, so the stamp reads as an outcome rather than
        a flourish. */}
    {!still && (
      <div className="absolute inset-x-0 bottom-[6%] flex justify-center gap-5">
        {LADDER.map((rung) => (
          <motion.span
            key={`${cycle}-${rung.label}`}
            className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px]"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rung.at, duration: 0.3 }}
          >
            <CheckIcon className="text-foreground/70 size-3" weight="bold" />
            {rung.label}
          </motion.span>
        ))}
      </div>
    )}

    {/* And the answer, stamped on. Pressed from the same chrome as the
        workspace's primary button. */}
    <motion.div
      key={still ? "paid" : `${cycle}-paid`}
      className={cn(
        "metal-plate absolute rounded-xl px-7 py-3.5",
        "font-mono text-sm tracking-[0.2em] uppercase",
      )}
      initial={still ? false : { opacity: 0, scale: 1.9, rotate: -14 }}
      animate={{ opacity: 1, scale: 1, rotate: -7 }}
      transition={{
        delay: still ? 0 : 2.75,
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      Paid {figure}
    </motion.div>
  </div>
);
