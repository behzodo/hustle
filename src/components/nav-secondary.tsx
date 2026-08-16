import * as React from "react";
import Link from "next/link";
import { type Icon } from "@phosphor-icons/react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string;
    url: string;
    icon: Icon;
  }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              {/* Quieter than the primary nav on purpose — support links are
                  a destination you look for, not one you navigate by. No
                  rail and no fill weight: these are not places you can be. */}
              <SidebarMenuButton
                asChild
                size="sm"
                className="group/sub text-foreground/55 hover:text-foreground/90 hover:bg-sidebar-accent/50 h-8 gap-2.5 rounded-lg px-2.5 text-sm tracking-[-0.011em] transition-colors duration-200"
              >
                <Link href={item.url}>
                  <item.icon
                    weight="light"
                    className="size-[18px] shrink-0 transition-transform duration-200 group-hover/sub:-translate-y-px"
                  />
                  <span className="truncate">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
