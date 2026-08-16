"use client"

import * as React from "react"
import Link from "next/link"
import {
  CreditCardIcon,
  FolderSimpleIcon,
  LifebuoyIcon,
  PaperPlaneTiltIcon,
  PlugIcon,
  SparkleIcon,
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
      title: "Build a site",
      url: "/dashboard",
      icon: SparkleIcon,
      isActive: true,
    },
    {
      title: "Your hustles",
      url: "/",
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
      url: "mailto:support@hustle.com",
      icon: LifebuoyIcon,
    },
    {
      title: "Feedback",
      url: "mailto:hello@hustle.com",
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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                {/* The mark alone — the wordmark is set beside it below, and
                    <Logo /> would render a second one. */}
                <MetallicLogo size={28} />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Hustle</span>
                  <span className="text-muted-foreground truncate text-xs">
                    Build theirs first
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      {/* Clerk's own button rather than the block's mock menu — sign-out and
          account management are already solved there. */}
      <SidebarFooter className="p-2">
        <UserControl showName />
      </SidebarFooter>
    </Sidebar>
  )
}
