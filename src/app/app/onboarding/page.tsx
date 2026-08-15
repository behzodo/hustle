import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { getProfile } from "@/modules/onboarding/server/guard";
import { MetallicLogo } from "@/components/metallic-logo";
import { OnboardingBackground } from "@/components/onboarding-background";
import { OnboardingWizard } from "@/modules/onboarding/ui/onboarding-wizard";

export const metadata: Metadata = {
  title: "Set up your patch",
  robots: { index: false, follow: false },
};

const Page = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Reopening the wizard after setup should edit, not start from blank.
  // getProfile swallows backend errors, so a blip degrades to an empty
  // wizard rather than a 500 — the prefill is a convenience, not a
  // prerequisite for setting up.
  const profile = await getProfile();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <OnboardingBackground />
      <MetallicLogo size={44} priority className="mb-8" />
      <OnboardingWizard
        defaultValues={
          profile
            ? {
                tradingName: profile.tradingName,
                experience: profile.experience,
                city: profile.city,
                industries: profile.industries,
                priceBand: profile.priceBand,
                tone: profile.tone,
              }
            : undefined
        }
      />
    </div>
  );
};

export default Page;
