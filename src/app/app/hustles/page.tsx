import type { Metadata } from "next";

import { WorkspaceShell } from "@/components/workspace-shell";
import { HustlesView } from "@/modules/hustles/ui/views/hustles-view";
import { requireOnboarding } from "@/modules/onboarding/server/guard";

export const metadata: Metadata = {
  title: "Your hustles",
  robots: { index: false, follow: false },
};

const Page = async () => {
  await requireOnboarding();

  return (
    <WorkspaceShell page="Your hustles">
      <HustlesView />
    </WorkspaceShell>
  );
};

export default Page;
