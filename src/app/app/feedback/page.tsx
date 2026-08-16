import type { Metadata } from "next";

import { WorkspaceShell } from "@/components/workspace-shell";
import { requireOnboarding } from "@/modules/onboarding/server/guard";
import { FeedbackView } from "@/modules/support/ui/views/feedback-view";

export const metadata: Metadata = {
  title: "Feedback",
  robots: { index: false, follow: false },
};

const Page = async () => {
  await requireOnboarding();

  return (
    <WorkspaceShell page="Feedback">
      <FeedbackView />
    </WorkspaceShell>
  );
};

export default Page;
