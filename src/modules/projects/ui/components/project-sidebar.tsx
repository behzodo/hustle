"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Ref } from "react";
import {
  FolderSimpleIcon,
  HammerIcon,
  LifebuoyIcon,
  PlugIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";

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
import { useProject } from "@/modules/projects/use-projects";

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

/**
 * Where this hustle's businesses live — the drawer the lead wall files into.
 *
 * Scoped to the hustle, not the gallery: the cards are what the sweep produced
 * here, so the icon they fly into has to be the icon that opens them.
 */
export const filedHref = (projectId: ProjectId) => `/hustles/${projectId}`;

export const ProjectSidebar = ({
  projectId,
  fileRef,
}: {
  projectId: ProjectId;
  /**
   * Handle on the "Building" icon.
   *
   * The lead wall flies its businesses into this glyph when it has finished
   * with them, which only works if something outside the rail can find out
   * where the glyph currently is. See lead-wall.tsx.
   */
  fileRef?: Ref<HTMLSpanElement>;
}) => {
  const project = useProject(projectId);
  const pathname = usePathname();

  const links: HoverSidebarLinkItem[] = [
    {
      label: "This hustle",
      href: `/projects/${projectId}`,
      icon: <HammerIcon className="size-5" />,
    },
    {
      // Named for what it holds rather than where it goes. Inside a hustle
      // this is the drawer the lead wall files its businesses into, and the
      // gallery it opens is the next thing you build from.
      label: "Building",
      href: filedHref(projectId),
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
                // Marked off the live path rather than a hardcoded route, so
                // Building lights up when you are reading the businesses and
                // This hustle when you are on the build.
                //
                // The endsWith is for the app subdomain: every href here is
                // written without the /app prefix the middleware rewrites to,
                // and which of the two paths reaches this hook is not worth
                // depending on.
                active={
                  pathname === link.href || pathname.endsWith(link.href)
                }
                iconRef={
                  link.href === filedHref(projectId) ? fileRef : undefined
                }
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
