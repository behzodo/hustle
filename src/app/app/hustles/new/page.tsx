import type { Metadata } from "next";

import { WorkspaceShell } from "@/components/workspace-shell";
import { requireOnboarding } from "@/modules/onboarding/server/guard";
import { NewHustleView } from "@/modules/hustles/ui/views/new-hustle-view";

export const metadata: Metadata = {
  title: "New hustle",
  robots: { index: false, follow: false },
};

const Page = async () => {
  await requireOnboarding();

  return (
    <WorkspaceShell page="New hustle">
      <NewHustleView />
    </WorkspaceShell>
  );
};

export default Page;
