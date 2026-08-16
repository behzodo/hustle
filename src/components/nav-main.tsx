"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { type Icon } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      {/* The same eyebrow treatment section labels get everywhere else, so
          the nav reads as part of the product rather than chrome. */}
      <SidebarGroupLabel className="eyebrow text-muted-foreground/70 h-auto px-2 pb-2 font-medium">
        Platform
      </SidebarGroupLabel>

      <SidebarMenu className="gap-0.5">
        {items.map((item) => {
          // Exact match: "/" is a prefix of everything, so startsWith would
          // light up "Your hustles" on every page in the workspace.
          const isActive = pathname === item.url

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.title}
                className={cn(
                  "group/nav relative h-9 gap-3 rounded-xl px-2 transition-colors",
                  "hover:bg-sidebar-accent/70",
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                )}
              >
                <Link href={item.url}>
                  {/* The marker is the whole active treatment's tell — a bar
                      on the rail, the way a good sidebar shows position. */}
                  <span
                    className={cn(
                      "bg-primary absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full transition-all",
                      isActive ? "opacity-100" : "h-0 opacity-0",
                    )}
                  />
                  {/* Filled at the current location, light everywhere else.
                      Phosphor's weights are the cheapest way to say "you are
                      here" without adding a colour. */}
                  <item.icon
                    weight={isActive ? "fill" : "light"}
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground group-hover/nav:text-foreground",
                    )}
                  />
                  <span className="truncate">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
