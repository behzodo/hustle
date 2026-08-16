"use client"

import * as React from "react"
import Link from "next/link"
import {
  CreditCardIcon,
  FolderSimpleIcon,
  LifebuoyIcon,
  PaperPlaneTiltIcon,
  PlugIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react"

import { MetallicLogo } from "@/components/metallic-logo"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { UserControl } from "@/components/user-control"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Only routes that exist. A dead link in the primary nav reads as a broken
// product, so anything still unbuilt stays out until it ships.
const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: SquaresFourIcon,
    },
    {
      title: "Your hustles",
      url: "/hustles",
      icon: FolderSimpleIcon,
    },
    {
      title: "Connections",
      url: "/connections",
      icon: PlugIcon,
    },
    {
      title: "Plan & credits",
      url: "/pricing",
      icon: CreditCardIcon,
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "/support",
      icon: LifebuoyIcon,
    },
    {
      title: "Feedback",
      url: "/feedback",
      icon: PaperPlaneTiltIcon,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="hover:bg-sidebar-accent/70 h-auto gap-3 rounded-xl px-2 py-2.5 transition-colors"
            >
              <Link href="/">
                {/* The mark alone — the wordmark is set beside it below, and
                    <Logo /> would render a second one. */}
                <MetallicLogo size={28} />
                <div className="grid flex-1 text-left leading-tight">
                  {/* Fraunces, like every other place the brand name is set
                      as a name rather than as running text. */}
                  <span className="font-display headline-display truncate text-[15px] tracking-[-0.02em]">
                    Hustle
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    Build theirs first
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <NavMain items={data.navMain} />
        {/* Hairline above the quiet group, so the footer block reads as its
            own thing rather than the tail of the nav. */}
        <NavSecondary
          items={data.navSecondary}
          className="border-sidebar-border/60 mt-auto border-t pt-2"
        />
      </SidebarContent>
      {/* Clerk's own button rather than the block's mock menu — sign-out and
          account management are already solved there. Extra bottom padding
          keeps the name off the viewport edge, where it was being clipped. */}
      <SidebarFooter className="border-sidebar-border/60 border-t px-2 pt-3 pb-4">
        <div className="min-w-0 overflow-hidden">
          <UserControl showName />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
