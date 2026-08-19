import type { Metadata } from "next";

import { WorkspaceShell } from "@/components/workspace-shell";
import { requireOnboarding } from "@/modules/onboarding/server/guard";
import { DomainsView } from "@/modules/domains/ui/views/domains-view";

export const metadata: Metadata = {
  title: "Domains",
  robots: { index: false, follow: false },
};

const Page = async () => {
  // Behind the wizard like every other workspace screen: a domain is bought
  // against a profile's trading name, and there is nothing here to see before
  // one exists.
  await requireOnboarding();

  return (
    <WorkspaceShell page="Domains">
      <DomainsView />
    </WorkspaceShell>
  );
};

export default Page;
