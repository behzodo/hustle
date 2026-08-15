import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MetallicLogo } from "@/components/metallic-logo";
import { requireOnboarding } from "@/modules/onboarding/server/guard";
import { GmailConnection } from "@/modules/connections/ui/gmail-connection";
import { StripeConnection } from "@/modules/connections/ui/stripe-connection";
import { getStripeStatus } from "@/modules/connections/server/stripe-status";

export const metadata: Metadata = {
  title: "Connections",
  robots: { index: false, follow: false },
};

const Page = async () => {
  // Connections come after the wizard, so the profile must exist first.
  const profile = await requireOnboarding();
  const stripeStatus = await getStripeStatus(profile?.stripeAccountId);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-16">
      <MetallicLogo size={44} priority className="mb-8" />

      <p className="eyebrow text-primary mb-3 font-medium">Almost there</p>
      <h1 className="headline-display font-display text-balance text-3xl leading-[1.02] tracking-[-0.03em] md:text-4xl">
        Hook up your tools
      </h1>
      <p className="deck font-display text-muted-foreground mt-3 text-balance text-lg leading-[1.45]">
        Both are optional — you can build sites without them and come back
        when you have someone to pitch.
      </p>

      <div className="mt-8 space-y-3">
        <GmailConnection connected={Boolean(profile?.gmailConnectionId)} />

        <StripeConnection status={stripeStatus} />
      </div>

      <div className="mt-10 flex items-center justify-between gap-3">
        <Button
          asChild
          variant="ghost"
          className="h-11 rounded-xl px-5 text-sm font-medium tracking-tight"
        >
          <Link href="/">Skip for now</Link>
        </Button>

        <Button
          asChild
          className="h-11 rounded-xl px-6 text-sm font-medium tracking-tight"
        >
          <Link href="/">Start building</Link>
        </Button>
      </div>
    </div>
  );
};

export default Page;
