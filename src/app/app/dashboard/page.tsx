import type { Metadata } from "next";

import { AppSidebar } from "@/components/app-sidebar";
import { IconProvider } from "@/components/icon-provider";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
    <div className="[--header-height:calc(--spacing(14))]">
      <IconProvider>
        <SidebarProvider className="flex flex-col">
          <SiteHeader />
          <div className="flex flex-1">
            <AppSidebar />
            <SidebarInset>
              <DashboardView />
            </SidebarInset>
          </div>
        </SidebarProvider>
      </IconProvider>
    </div>
  );
};

export default Page;
