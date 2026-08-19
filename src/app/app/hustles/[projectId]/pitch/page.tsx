import type { Metadata } from "next";

import { HustlePitchView } from "@/modules/hustles/ui/views/hustle-pitch-view";
import { requireOnboarding } from "@/modules/onboarding/server/guard";
import type { Id } from "@/../convex/_generated/dataModel";

export const metadata: Metadata = {
  title: "Pitching",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ projectId: string }>;
}

/**
 * The hustle's own rail again, not the workspace shell — see the Building
 * page beside this one for why.
 */
const Page = async ({ params }: Props) => {
  await requireOnboarding();

  const { projectId } = await params;

  return <HustlePitchView projectId={projectId as Id<"projects">} />;
};

export default Page;
