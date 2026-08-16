import { AppSidebar } from "@/components/app-sidebar";
import { IconProvider } from "@/components/icon-provider";
import { SiteHeader } from "@/components/site-header";
import { SupportWidget } from "@/modules/support/ui/components/support-widget";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface Props {
  /** Last crumb in the header — the page you are on. */
  page: string;
  children: React.ReactNode;
}

/**
 * Header, sidebar and content well for every workspace screen.
 *
 * Lives in one place so a second page cannot drift from the first: the
 * --header-height variable, the icon weight and the sidebar are all set here
 * once rather than copied into each route.
 */
export const WorkspaceShell = ({ page, children }: Props) => (
  <div className="[--header-height:calc(--spacing(14))]">
    <IconProvider>
      <SidebarProvider className="flex flex-col">
        <SiteHeader page={page} />
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset>{children}</SidebarInset>
        </div>

        {/* Mounted once here rather than per page, so the helper is reachable
            from anywhere in the workspace without each route remembering. */}
        <SupportWidget />
      </SidebarProvider>
    </IconProvider>
  </div>
);
