import {
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  PlugsConnectedIcon,
  ReceiptIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { GmailConnection } from "@/modules/connections/ui/gmail-connection";
import { StripeConnection } from "@/modules/connections/ui/stripe-connection";
import type { StripeStatus } from "@/modules/connections/server/stripe-status";

interface Props {
  gmailConnected: boolean;
  stripeStatus: StripeStatus;
}

export const ConnectionsView = ({ gmailConnected, stripeStatus }: Props) => {
  const stripeReady = stripeStatus === "ready";
  const live = Number(gmailConnected) + Number(stripeReady);
  const complete = live === 2;

  // Each step unlocks with the connection that powers it. Building needs
  // nothing, so it starts done — the sequence should read as already moving
  // rather than as three locked doors.
  const steps = [
    {
      icon: PlugsConnectedIcon,
      title: "Build",
      body: "Name a business and the agent writes their site. No account needed.",
      done: true,
    },
    {
      icon: EnvelopeSimpleIcon,
      title: "Pitch",
      body: "Outreach sends from your own Gmail, so it lands like a person wrote it.",
      done: gmailConnected,
    },
    {
      icon: ReceiptIcon,
      title: "Get paid",
      body: "Stripe raises the invoice and pays your bank. Hustle keeps 30%.",
      done: stripeReady,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 md:p-6">
      <div>
        <p className="eyebrow text-muted-foreground/70 font-medium">Setup</p>
        <h1 className="headline-display font-display mt-2 text-3xl leading-[1.02] tracking-[-0.03em] text-balance md:text-4xl">
          {complete ? (
            <>
              You are{" "}
              <span className="headline-figure text-primary italic">wired</span>{" "}
              up.
            </>
          ) : (
            <>
              Two accounts,{" "}
              <span className="headline-figure text-primary italic">paid</span>{" "}
              clients.
            </>
          )}
        </h1>
        <p className="deck font-display text-muted-foreground mt-2 text-balance">
          {complete
            ? "Everything is connected. Build a site, send it, invoice them."
            : "Neither is needed to build. Come back when you have someone to pitch."}
        </p>

        {/* A two-segment meter rather than a number on its own. With only two
            connections, the bar IS the checklist. */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {[gmailConnected, stripeReady].map((done, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-500",
                  done ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
          <span className="text-muted-foreground shrink-0 text-sm">
            <span className="text-foreground font-medium tabular-nums">
              {live}
            </span>{" "}
            of 2 connected
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <GmailConnection connected={gmailConnected} />
        <StripeConnection status={stripeStatus} />
      </div>

      {/* The sequence the two accounts sit inside. Numbered like a contents
          page — the figures are set in the display face and left faint, so
          they order the columns without competing with them. */}
      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map(({ icon: Icon, title, body, done }, i) => (
          <div
            key={title}
            className={cn(
              "bg-white dark:bg-sidebar group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
              !done && "opacity-60",
            )}
          >
            <span className="headline-figure font-display text-foreground/[0.06] pointer-events-none absolute -top-3 right-1 text-6xl leading-none tabular-nums select-none">
              {`0${i + 1}`}
            </span>

            <div className="relative flex items-center justify-between">
              <Icon className="text-muted-foreground size-5" weight="light" />
              {done && (
                <CheckCircleIcon
                  className="text-primary size-4"
                  weight="fill"
                />
              )}
            </div>

            <p className="relative mt-3 text-sm font-medium">{title}</p>
            <p className="text-muted-foreground relative mt-1 text-sm leading-snug">
              {body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
