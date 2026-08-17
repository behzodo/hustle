import type { Metadata } from "next";

import { WorkspaceShell } from "@/components/workspace-shell";
import { LeadsView } from "@/modules/hustles/ui/views/leads-view";
import { requireOnboarding } from "@/modules/onboarding/server/guard";

/**
 * A preview of the discovery sweep's output.
 *
 * Temporary and unlinked from the sidebar on purpose: the finished home for
 * this list is inside a hustle, beside the sweep animation. It stands alone
 * for now so the search terms and the website verdict can be read against
 * real businesses before either is wired into a screen users see.
 */
export const metadata: Metadata = {
  title: "Leads (preview)",
  robots: { index: false, follow: false },
};

const Page = async () => {
  await requireOnboarding();

  return (
    <WorkspaceShell page="Leads (preview)">
      <LeadsView />
    </WorkspaceShell>
  );
};

export default Page;
