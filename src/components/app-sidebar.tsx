"use client";

import * as React from "react";
import Link from "next/link";
import {
  BrowsersIcon,
  ChatTeardropDotsIcon,
  CoinsIcon,
  GaugeIcon,
  LifebuoyIcon,
  PlugsConnectedIcon,
  PlusIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { MetallicLogo } from "@/components/metallic-logo";
import { NavMain, type NavItem } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { UserControl } from "@/components/user-control";
import { useProjects } from "@/modules/projects/use-projects";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";

// Only routes that exist. A dead link in the primary nav reads as a broken
// product, so anything still unbuilt stays out until it ships.
//
// Each glyph names the thing rather than its category: a hustle is a run of
// websites, so it gets browser windows instead of a folder; credits are what
// you spend, so they get coins instead of a card; and the dashboard is a
// reading rather than a grid of boxes.
const NAV_MAIN: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: GaugeIcon },
  { title: "Your hustles", url: "/hustles", icon: BrowsersIcon },
  { title: "Connections", url: "/connections", icon: PlugsConnectedIcon },
  { title: "Plan & credits", url: "/pricing", icon: CoinsIcon },
];

const NAV_SECONDARY = [
  { title: "Support", url: "/support", icon: LifebuoyIcon },
  { title: "Feedback", url: "/feedback", icon: ChatTeardropDotsIcon },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const projects = useProjects();

  const items = NAV_MAIN.map((item) =>
    item.url === "/hustles" ? { ...item, count: projects?.length } : item,
  );

  return (
    <Sidebar
      // Floating rather than flush: at this palette a flush panel and the
      // content well are the same dark field with a hairline between them,
      // and the nav stops reading as a surface you can pick up.
      variant="floating"
      className={cn(
        "top-(--header-height) h-[calc(100svh-var(--header-height))]!",
        "[&_[data-sidebar=sidebar]]:rounded-2xl",
      )}
      {...props}
    >
      <SidebarHeader className="gap-4 p-3">
        <Link
          href="/"
          className="group/brand hover:bg-sidebar-accent/50 -mx-1 flex items-center gap-2.5 rounded-xl px-1 py-1 transition-colors"
        >
          {/* The mark alone — the wordmark is set beside it, and <Logo />
              would render a second one. */}
          <span className="ring-sidebar-border/70 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1">
            <MetallicLogo size={32} />
          </span>
          <span className="grid min-w-0 flex-1 leading-tight">
            {/* Fraunces, like every other place the brand name is set as a
                name rather than as running text. */}
            <span className="font-display headline-display truncate text-[15px] tracking-[-0.02em]">
              Hustle
            </span>
            <span className="text-muted-foreground/70 truncate text-[11px]">
              Build theirs first
            </span>
          </span>
        </Link>

        {/* The product in one control. Everything else in this panel is a
            place you go; this is the only thing you do, so it is the only
            thing given a surface — the same chrome the mark above it is
            painted in, so the panel has one material rather than an accent. */}
        <Link
          href="/hustles/new"
          className={cn(
            "metal-plate flex h-10 items-center justify-center rounded-xl",
            "text-[13px] font-medium tracking-tight",
            "transition-transform duration-200 hover:-translate-y-px",
            "focus-visible:ring-foreground/60 focus-visible:ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "motion-reduce:transform-none motion-reduce:transition-none",
          )}
        >
          {/* Above the sheen, which is painted at z-index 1. */}
          <span className="relative z-[2] flex items-center gap-2">
            <PlusIcon weight="bold" className="size-4" />
            New hustle
          </span>
        </Link>
      </SidebarHeader>

      {/* overflow-x-hidden because a long hustle name has nowhere to go in a
          240px rail, and a horizontal scrollbar across the nav is never the
          right answer — the rows truncate instead. */}
      <SidebarContent className="gap-0 overflow-x-hidden">
        <NavMain items={items} />

        {/* Hairline above the quiet group, so the footer block reads as its
            own thing rather than the tail of the nav. */}
        <NavSecondary
          items={NAV_SECONDARY}
          className="border-sidebar-border/60 mt-auto border-t px-3 pt-2 pb-0"
        />
      </SidebarContent>

      {/* Clerk's own button rather than the block's mock menu — sign-out and
          account management are already solved there. */}
      <SidebarFooter className="border-sidebar-border/60 mt-3 border-t p-3">
        <div className="flex w-full min-w-0 items-center">
          <UserControl showName />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
