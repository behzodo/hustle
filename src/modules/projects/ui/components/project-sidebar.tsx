"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import {
  FolderSimpleIcon,
  HammerIcon,
  LifebuoyIcon,
  PlugIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";

import { api } from "@/../convex/_generated/api";
import { MetallicLogo } from "@/components/metallic-logo";
import { UserControl } from "@/components/user-control";
import { motion } from "motion/react";
import {
  HoverSidebar,
  HoverSidebarBody,
  HoverSidebarLink,
  useHoverSidebar,
  type HoverSidebarLinkItem,
} from "@/components/ui/hover-sidebar";
import type { ProjectId } from "@/modules/projects/types";

/**
 * The rail down the side of a hustle's workspace.
 *
 * The project view runs outside WorkspaceShell — it takes the whole screen so
 * the preview has room — which left it as the one place in the product with
 * no way out except the browser's back button. This is that way out.
 *
 * Only routes that exist, the same rule the main sidebar keeps: a dead link
 * in the nav reads as a broken product.
 */

/** Shown collapsed as a mark, expanded as the name. */
const Brand = ({ name }: { name?: string }) => {
  const { open, animate } = useHoverSidebar();

  return (
    <Link
      href="/hustles"
      className="mb-6 flex items-center gap-3 px-1.5 focus-visible:ring-ring rounded-lg outline-none focus-visible:ring-2"
    >
      <MetallicLogo className="size-7 shrink-0" />
      <motion.span
        animate={{
          width: animate ? (open ? "auto" : 0) : "auto",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="font-display overflow-hidden text-sm whitespace-pre"
      >
        {name ?? "Hustle"}
      </motion.span>
    </Link>
  );
};

export const ProjectSidebar = ({ projectId }: { projectId: ProjectId }) => {
  const project = useQuery(api.projects.get, { projectId });

  const links: HoverSidebarLinkItem[] = [
    {
      label: "This hustle",
      href: `/projects/${projectId}`,
      icon: <HammerIcon className="size-5" />,
    },
    {
      label: "Your hustles",
      href: "/hustles",
      icon: <FolderSimpleIcon className="size-5" />,
    },
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <SquaresFourIcon className="size-5" />,
    },
    {
      label: "Connections",
      href: "/connections",
      icon: <PlugIcon className="size-5" />,
    },
    {
      label: "Support",
      href: "/support",
      icon: <LifebuoyIcon className="size-5" />,
    },
  ];

  return (
    <HoverSidebar>
      <HoverSidebarBody className="justify-between">
        <div className="flex min-w-0 flex-col">
          <Brand name={project?.name} />

          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <HoverSidebarLink
                key={link.href}
                link={link}
                active={link.href === `/projects/${projectId}`}
              />
            ))}
          </nav>
        </div>

        <div className="px-1.5">
          <UserControl />
        </div>
      </HoverSidebarBody>
    </HoverSidebar>
  );
};
