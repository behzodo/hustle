import Link from "next/link";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import { SupportChat } from "../components/support-chat";
import { HelpBackdrop } from "../components/help-backdrop";

// Answers that never change, so nobody burns a round trip on them.
const FAQ = [
  {
    q: "How do credits work?",
    a: "One credit per generation. Free gives 2 a month, Pro 100, Max 1000, on a 30-day window that refills all at once.",
  },
  {
    q: "Why does my dashboard show numbers I never made?",
    a: "The lead, pipeline and revenue panels are sample data while those features are being built. Every one of them is badged “sample”.",
  },
  {
    q: "Do I need Gmail and Stripe?",
    a: "No. You can build sites without either. Connect them when you have someone to pitch and someone to invoice.",
  },
  {
    q: "What does Hustle take?",
    a: "30% of what you invoice through Stripe, on top of your plan. Nothing on work you bill outside Hustle.",
  },
];

export const SupportView = () => (
  <div className="relative flex-1">
    <HelpBackdrop />

    {/* Positioned, and after the backdrop in source order — both sit at the
        same layer, so that is what keeps the page painted over the metal. */}
    <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 md:p-6">
      <div>
        <p className="eyebrow text-muted-foreground/70 font-medium">Support</p>
        <h1 className="headline-display font-display mt-2 text-3xl leading-[1.02] tracking-[-0.03em] text-balance md:text-4xl">
          Ask, and keep{" "}
          <span className="headline-figure text-primary italic">building</span>.
        </h1>
        <p className="deck font-display text-muted-foreground mt-2 text-balance">
          The assistant knows how Hustle works. It cannot see your account, so
          anything account-specific goes to a human.
        </p>
      </div>

      {/* Fixed height: the chat has to own a scroll area, and a panel that grows
        with the conversation would push the FAQ off the screen. */}
      <div className="milled bg-white dark:bg-sidebar flex h-[30rem] flex-col overflow-hidden rounded-2xl border">
        <SupportChat className="flex-1" />
      </div>

      <div>
        <h2 className="font-display headline-display text-lg tracking-[-0.02em]">
          Common questions
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {FAQ.map(({ q, a }) => (
            <div
              key={q}
              className="milled bg-white dark:bg-sidebar rounded-2xl border p-4"
            >
              <dt className="text-sm font-medium">{q}</dt>
              <dd className="text-muted-foreground mt-1 text-sm leading-snug">
                {a}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="milled bg-white dark:bg-sidebar flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <EnvelopeSimpleIcon
            className="text-muted-foreground size-5"
            weight="light"
          />
          <div>
            <p className="text-sm font-medium">Still stuck?</p>
            <p className="text-muted-foreground text-sm">
              A person reads every mail to support@hustle.com.
            </p>
          </div>
        </div>
        <Link
          href="mailto:support@hustle.com"
          className="text-sm font-medium underline underline-offset-4"
        >
          Email us
        </Link>
      </div>
    </div>
  </div>
);
