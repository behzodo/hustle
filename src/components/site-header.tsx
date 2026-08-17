"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { SidebarSimpleIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { SearchForm } from "@/components/search-form";
import { MetallicLogo } from "@/components/metallic-logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useSidebar } from "@/components/ui/sidebar";

export function SiteHeader({ page = "Dashboard" }: { page?: string }) {
  const { toggleSidebar } = useSidebar();
  const { user } = useUser();

  return (
    // Frosted rather than solid: the page scrolls under this bar, and an
    // opaque strip guillotines whatever passes beneath it. The foot is a
    // gradient hairline instead of a border — light catching a milled edge,
    // brightest in the middle, gone at both ends.
    <header
      className={cn(
        "bg-background/70 sticky top-0 z-50 flex w-full items-center backdrop-blur-xl",
        "after:via-foreground/18 after:absolute after:inset-x-0 after:bottom-0 after:h-px",
        "after:bg-gradient-to-r after:from-transparent after:to-transparent",
      )}
    >
      <div className="flex h-(--header-height) w-full items-center gap-3 px-3 sm:px-4">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="text-foreground/55 hover:bg-accent/60 hover:text-foreground focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <SidebarSimpleIcon weight="light" className="size-[18px]" />
        </button>

        <span aria-hidden className="bg-border/70 h-5 w-px shrink-0" />

        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="gap-2 text-sm sm:gap-2.5">
            {/* The real chrome mark, not the flat one. It costs a WebGL
                context, but this is the only place the brand is named on
                screen once the sidebar is collapsed. */}
            <BreadcrumbItem className="hidden sm:flex">
              <BreadcrumbLink asChild>
                <Link
                  href="/"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                >
                  <MetallicLogo size={24} />
                  Hustle
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator className="text-muted-foreground/30 hidden sm:block [&>svg]:size-3" />

            {/* Points at the workspace, not at "/" like the crumb above it —
                two links to the same page is a hierarchy that only looks
                like one. */}
            <BreadcrumbItem className="hidden sm:flex">
              <BreadcrumbLink asChild>
                <Link
                  href="/dashboard"
                  className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                >
                  <Avatar className="ring-border/60 size-5 rounded-md ring-1">
                    <AvatarImage src={user?.imageUrl} alt="" />
                    <AvatarFallback className="rounded-md text-[10px]">
                      {user?.firstName?.[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  {user?.firstName ?? "You"}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>

            <BreadcrumbSeparator className="text-muted-foreground/30 hidden sm:block [&>svg]:size-3" />

            <BreadcrumbItem className="min-w-0">
              {/* Where you are, milled out of the same chrome as everything
                  else that matters in here. */}
              <BreadcrumbPage className="metal-text font-display headline-display truncate text-[15px] tracking-[-0.02em]">
                {page}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <SearchForm className="ml-auto min-w-0 shrink" />
      </div>
    </header>
  );
}
