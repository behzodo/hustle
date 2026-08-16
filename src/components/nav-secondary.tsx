import * as React from "react"
import { type Icon } from "@phosphor-icons/react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {/* Quieter than the primary nav on purpose — support links are
                  a destination you look for, not one you navigate by. */}
              <SidebarMenuButton
                asChild
                size="sm"
                className="group/sub text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 h-8 gap-3 rounded-lg px-2 transition-colors"
              >
                <a href={item.url}>
                  <item.icon className="size-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
