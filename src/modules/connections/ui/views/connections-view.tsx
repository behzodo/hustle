import {
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  PlugsConnectedIcon,
  ReceiptIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { SilkBackdrop } from "@/components/silk-backdrop";
import { GmailConnection } from "@/modules/connections/ui/gmail-connection";
import { TextingConnection } from "@/modules/connections/ui/texting-connection";
import {
  FacebookConnection,
  InstagramConnection,
} from "@/modules/connections/ui/social-connections";
import { StripeConnection } from "@/modules/connections/ui/stripe-connection";
import type { StripeStatus } from "@/modules/connections/server/stripe-status";

interface Props {
  gmailConnected: boolean;
  textingConnected: boolean;
  /** The number texts go out from, once one has been bought. */
  textingNumber?: string;
  instagramConnected: boolean;
  facebookConnected: boolean;
  stripeStatus: StripeStatus;
}

export const ConnectionsView = ({
  gmailConnected,
  textingConnected,
  textingNumber,
  instagramConnected,
  facebookConnected,
  stripeStatus,
}: Props) => {
  const stripeReady = stripeStatus === "ready";

  // Texting only counts once a number has been bought. A connected account
  // with no number cannot send anything, and a meter that says otherwise is a
  // meter telling the user they are ready when they are not.
  const canText = textingConnected && Boolean(textingNumber);

  // The meter counts the three that have to be true before a pound can be
  // earned: something to send from, and somewhere to be paid. Instagram and
  // Facebook are not on it — they only ever receive, so a hustle without them
  // is not incomplete.
  const rungs = [gmailConnected || canText, canText, stripeReady];
  const live = rungs.filter(Boolean).length;
  const complete = live === rungs.length;

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
      body: "Email lands like a person wrote it. Texting reaches the ones with no email at all.",
      done: gmailConnected || canText,
    },
    {
      icon: ReceiptIcon,
      title: "Get paid",
      body: "Stripe raises the invoice and pays your bank. Hustle keeps 30%.",
      done: stripeReady,
    },
  ];

  return (
    <div className="relative flex-1">
      <SilkBackdrop />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 md:p-6">
        <div>
          <p className="eyebrow text-muted-foreground/70 font-medium">Setup</p>
          <h1 className="headline-display font-display mt-2 text-3xl leading-[1.02] tracking-[-0.03em] text-balance md:text-4xl">
            {complete ? (
              <>
                You are{" "}
                <span className="headline-figure text-primary italic">
                  wired
                </span>{" "}
                up.
              </>
            ) : (
              <>
                A way in,{" "}
                <span className="headline-figure text-primary italic">
                  paid
                </span>{" "}
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
              {rungs.map((done, i) => (
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
              of {rungs.length} connected
            </span>
          </div>
        </div>

        {/* Ordered by what reaches the most businesses. Texting is first
          because three in a hundred have an email and all of them have a
          phone — the order of this list is the order of the numbers. */}
        <div className="space-y-3">
          <TextingConnection
            connected={textingConnected}
            number={textingNumber}
          />
          <GmailConnection connected={gmailConnected} />
          <StripeConnection status={stripeStatus} />
        </div>

        <div className="space-y-3">
          <div>
            <p className="eyebrow text-muted-foreground/70 font-medium">
              For replies
            </p>
            <p className="text-muted-foreground mt-1.5 text-sm text-balance">
              Neither can start a conversation — Meta does not allow a business
              to message somebody first. Connect them so a shop that answers on
              Instagram lands in the same inbox as everyone else.
            </p>
          </div>

          <InstagramConnection connected={instagramConnected} />
          <FacebookConnection connected={facebookConnected} />
        </div>

        {/* The sequence the two accounts sit inside. Numbered like a contents
          page — the figures are set in the display face and left faint, so
          they order the columns without competing with them. */}
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body, done }, i) => (
            <div
              key={title}
              className={cn(
                // Translucent rather than solid so the weave behind still reads
                // through the column — opaque plates would punch three holes in it.
                "dark:bg-sidebar/60 group relative overflow-hidden rounded-2xl border bg-white/70 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
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
    </div>
  );
};
