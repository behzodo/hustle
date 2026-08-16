import type { Metadata } from "next";

import { WorkspaceShell } from "@/components/workspace-shell";
import { requireOnboarding } from "@/modules/onboarding/server/guard";
import { SupportView } from "@/modules/support/ui/views/support-view";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

const Page = async () => {
  await requireOnboarding();

  return (
    <WorkspaceShell page="Support">
      <SupportView />
    </WorkspaceShell>
  );
};

export default Page;
