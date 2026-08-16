import type { Metadata } from "next";

import { WorkspaceShell } from "@/components/workspace-shell";
import { DashboardView } from "@/modules/dashboard/ui/views/dashboard-view";
import { requireOnboarding } from "@/modules/onboarding/server/guard";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

const Page = async () => {
  // Signed-in surface, so the same gate as the rest of the workspace.
  await requireOnboarding();

  return (
    <WorkspaceShell page="Dashboard">
      <DashboardView />
    </WorkspaceShell>
  );
};

export default Page;
