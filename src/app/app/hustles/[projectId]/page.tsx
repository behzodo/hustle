import type { Metadata } from "next";

import { HustleLeadsView } from "@/modules/hustles/ui/views/hustle-leads-view";
import { requireOnboarding } from "@/modules/onboarding/server/guard";
import type { Id } from "@/../convex/_generated/dataModel";

export const metadata: Metadata = {
  title: "Building",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ projectId: string }>;
}

/**
 * No WorkspaceShell: this screen carries the hustle's own rail, the same way
 * the project view does. It is a room inside one hustle, and the workspace
 * sidebar would take the user out of it to show them what is in it.
 */
const Page = async ({ params }: Props) => {
  await requireOnboarding();

  const { projectId } = await params;

  return <HustleLeadsView projectId={projectId as Id<"projects">} />;
};

export default Page;
