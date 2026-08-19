import type { Metadata } from "next";

import { WorkspaceShell } from "@/components/workspace-shell";
import { requireOnboarding } from "@/modules/onboarding/server/guard";
import { ConnectionsView } from "@/modules/connections/ui/views/connections-view";
import { getStripeStatus } from "@/modules/connections/server/stripe-status";

export const metadata: Metadata = {
  title: "Connections",
  robots: { index: false, follow: false },
};

const Page = async () => {
  // Connections come after the wizard, so the profile must exist first.
  const profile = await requireOnboarding();
  const stripeStatus = await getStripeStatus(profile?.stripeAccountId);

  return (
    <WorkspaceShell page="Connections">
      <ConnectionsView
        gmailConnected={Boolean(profile?.gmailConnectionId)}
        textingConnected={Boolean(profile?.twilioConnectionId)}
        textingNumber={profile?.twilioNumber}
        instagramConnected={Boolean(profile?.instagramConnectionId)}
        facebookConnected={Boolean(profile?.facebookConnectionId)}
        stripeStatus={stripeStatus}
      />
    </WorkspaceShell>
  );
};

export default Page;
