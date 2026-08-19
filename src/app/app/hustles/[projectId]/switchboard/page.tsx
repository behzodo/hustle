import type { Metadata } from "next";

import { HustleSwitchboardView } from "@/modules/hustles/ui/views/hustle-switchboard-view";
import { requireOnboarding } from "@/modules/onboarding/server/guard";
import type { Id } from "@/../convex/_generated/dataModel";

export const metadata: Metadata = {
  title: "Switchboard",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ projectId: string }>;
}

/**
 * The hustle's own rail again, not the workspace shell — see the Pitching page
 * beside this one for why.
 */
const Page = async ({ params }: Props) => {
  await requireOnboarding();

  const { projectId } = await params;

  return <HustleSwitchboardView projectId={projectId as Id<"projects">} />;
};

export default Page;
