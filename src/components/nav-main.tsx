"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Icon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export interface NavItem {
  title: string;
  url: string;
  icon: Icon;
  /** Live tally shown on the right. Omitted where there is nothing to count. */
  count?: number;
}

export function NavMain({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <SidebarGroup className="px-3 py-0">
      {/* The same eyebrow treatment section labels get everywhere else, so
          the nav reads as part of the product rather than chrome. */}
      <SidebarGroupLabel className="eyebrow text-muted-foreground/60 h-auto px-2 pb-2.5 font-medium">
        Platform
      </SidebarGroupLabel>

      <SidebarMenu className="gap-0.5">
        {items.map((item) => {
          // Exact match: "/" is a prefix of everything, so startsWith would
          // light up "Your hustles" on every page in the workspace.
          const isActive = pathname === item.url;

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.title}
                className={cn(
                  "group/nav relative h-9 gap-2.5 overflow-hidden rounded-lg px-2.5",
                  "text-sm tracking-[-0.011em] transition-colors duration-200",
                  "text-foreground/65 hover:text-foreground hover:bg-sidebar-accent/60",
                  isActive &&
                    "bg-sidebar-accent/70 text-foreground font-medium",
                )}
              >
                <Link href={item.url}>
                  {/* The whole active treatment: a polished pin on the edge
                      and a wash falling away from it. The pin is a gradient
                      rather than a flat bar so it catches light like the
                      chrome above it, and it grows out of the edge rather
                      than fading in — moving between pages should look like
                      one mark sliding, not two marks blinking. */}
                  <span
                    aria-hidden
                    className={cn(
                      "from-foreground/90 via-foreground/60 to-foreground/25 absolute top-1/2 left-0 w-[2px] -translate-y-1/2 rounded-r-full bg-gradient-to-b transition-all duration-300 ease-out",
                      isActive ? "h-5 opacity-100" : "h-0 opacity-0",
                    )}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "from-foreground/[0.07] pointer-events-none absolute inset-y-0 left-0 w-3/4 bg-gradient-to-r to-transparent transition-opacity duration-300",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />

                  {/* Thin strokes, drawn a little larger and a lot brighter.
                      The first pass read as scratches because "light" was
                      paired with muted grey — the fix is the colour, not the
                      weight, and going heavier only turned the icons into
                      blobs. Active steps up one weight rather than to "fill":
                      a solid glyph is the heaviest thing in the panel and the
                      rail already says where you are. */}
                  <item.icon
                    weight={isActive ? "regular" : "light"}
                    className={cn(
                      "relative size-[18px] shrink-0 transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-foreground/70 group-hover/nav:text-foreground",
                    )}
                  />
                  <span className="relative truncate">{item.title}</span>

                  {/* Only rendered once the number is known — a 0 flashing to
                      12 on every page load is worse than a beat of nothing. */}
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={cn(
                        "relative ml-auto shrink-0 text-[11px] font-medium tabular-nums transition-colors",
                        isActive
                          ? "text-foreground/65"
                          : "text-foreground/35 group-hover/nav:text-foreground/55",
                      )}
                    >
                      {item.count}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
