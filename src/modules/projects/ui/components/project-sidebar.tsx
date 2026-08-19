"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode, type Ref } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  FolderSimpleIcon,
  HammerIcon,
  LifebuoyIcon,
  PaperPlaneTiltIcon,
  PlugIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";

import { MetallicLogo } from "@/components/metallic-logo";
import { UserControl } from "@/components/user-control";
import {
  HoverSidebar,
  HoverSidebarBody,
  HoverSidebarLink,
  useHoverSidebar,
  type HoverSidebarLinkItem,
} from "@/components/ui/hover-sidebar";
import type { ProjectId } from "@/modules/projects/types";
import { useProject } from "@/modules/projects/use-projects";
import { useHunt } from "@/modules/hustles/use-discovery";

/**
 * The rail down the side of a hustle's workspace.
 *
 * The project view runs outside WorkspaceShell — it takes the whole screen so
 * the preview has room — which left it as the one place in the product with
 * no way out except the browser's back button. This is that way out.
 *
 * Painted in the same material as the workspace rail rather than a plainer
 * version of it: the chrome mark in its ringed tile, the plate under it, an
 * eyebrow over each group, a polished pin on the page you are on. Not
 * decoration for its own sake — a hustle takes over the whole screen, so this
 * rail is the only thing left saying which product you are inside, and a rail
 * that looks like a cheaper copy of the one you came from reads as having left
 * the app.
 *
 * What it does not copy is the width. The workspace rail is always open; this
 * one sits shut at 64px and widens on hover, because everything to the right
 * of it is a preview of a client's site and wants the pixels more.
 *
 * Only routes that exist, the same rule the main sidebar keeps: a dead link
 * in the nav reads as a broken product.
 */

/** How wide a label box is when the rail is open. */
const LABEL_W = 180;

/**
 * The hustle, as a brand block.
 *
 * The mark is the workspace rail's, in the same ringed tile, and the two lines
 * beside it answer the two questions this screen otherwise cannot: which
 * hustle this is, and where it hunts. The patch rather than a tagline, because
 * a tagline is the same on every hustle and the patch never is.
 */
const Brand = ({ name, patch }: { name?: string; patch?: string }) => {
  const { open, animate } = useHoverSidebar();

  return (
    <Link
      href="/hustles"
      className="group/brand hover:bg-sidebar-accent/50 focus-visible:ring-ring flex items-center gap-2.5 rounded-xl px-1 py-1 transition-colors outline-none focus-visible:ring-2"
    >
      <span className="ring-sidebar-border/70 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1">
        <MetallicLogo size={32} />
      </span>

      {/* A fixed width rather than "auto": the two lines inside can only
          truncate against a bounded box, and a hustle named after a business
          with a long name is the normal case here, not the edge one. */}
      <motion.span
        animate={{
          width: animate ? (open ? LABEL_W : 0) : LABEL_W,
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="grid min-w-0 overflow-hidden leading-tight"
      >
        <span className="font-display headline-display truncate text-[15px] tracking-[-0.02em]">
          {name ?? "Hustle"}
        </span>
        <span className="text-muted-foreground/70 truncate text-[11px]">
          {patch ?? "Build theirs first"}
        </span>
      </motion.span>
    </Link>
  );
};

/**
 * What the rail says instead of a button.
 *
 * The workspace rail puts its one action here — a plate that starts another
 * hustle. Inside a hustle that is the wrong thing to offer: you are already in
 * one, and the work on this screen is done by prompting the build, not by a
 * button in the furniture. So the slot keeps the material and drops the
 * control, and the metal says something instead.
 *
 * Every line is about the money, not about the websites. Nobody opens this
 * screen because they want to build a page for a barber shop — they open it
 * because the list on the other side of it is invoices that have not been
 * written yet, and the rail should say so.
 */
const LINES = [
  "Money is sitting in this list.",
  "One yes pays for the month.",
  "This patch is a payday.",
  "Every name here is a fee.",
  "Go and get paid.",
];

/** How long each line holds before the next one takes over. */
const LINE_MS = 7000;

const Hype = () => {
  const { open, animate } = useHoverSidebar();
  const still = Boolean(useReducedMotion());
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Held on the first line for anyone who asked for less motion. A line that
    // swaps itself out is motion, however gently it is faded.
    if (still) return;

    const timer = setInterval(
      () => setIndex((current) => (current + 1) % LINES.length),
      LINE_MS,
    );

    return () => clearInterval(timer);
  }, [still]);

  return (
    // The height is held whether or not there is room to read it, so the nav
    // underneath does not step up the rail every time the mouse leaves.
    <motion.div
      aria-hidden={!open}
      animate={{ opacity: animate ? (open ? 1 : 0) : 1 }}
      className="relative h-6 px-1"
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={still ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={still ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: 0.45 }}
          // Clipped to the glyphs, so the line is cut from the same metal as
          // the mark above it rather than being a second accent beside it.
          className="metal-text font-display headline-display absolute inset-0 flex items-center text-[13px] tracking-[-0.01em] whitespace-nowrap"
        >
          {LINES[index]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * The eyebrow over a group of links.
 *
 * Traded for a hairline when the rail is shut rather than removed, so the
 * groups stay separated at 64px and — more to the point — nothing below it
 * moves. A label that collapsed its own height would shuffle every row on the
 * rail up and down on hover, which is a lot of movement to pay for one word.
 */
const GroupLabel = ({ children }: { children: ReactNode }) => {
  const { open, animate } = useHoverSidebar();
  const shown = animate ? open : true;

  return (
    <div className="relative h-4">
      <motion.span
        animate={{ opacity: shown ? 1 : 0 }}
        className="eyebrow text-muted-foreground/60 absolute inset-y-0 left-2.5 flex items-center font-medium whitespace-nowrap"
      >
        {children}
      </motion.span>

      <motion.span
        aria-hidden
        animate={{ opacity: shown ? 0 : 1 }}
        className="bg-sidebar-border absolute top-1/2 left-2.5 h-px w-5 -translate-y-1/2"
      />
    </div>
  );
};

/**
 * Clerk's own button, named only where there is room for a name.
 *
 * `showName` follows the rail rather than staying on: the identifier is laid
 * out at its natural width, and inside a 40px column truncating it leaves a
 * letter and a half sitting against the avatar.
 */
const UserRow = () => {
  const { open, animate } = useHoverSidebar();

  return (
    <div className="flex w-full min-w-0 items-center">
      <UserControl showName={animate ? open : true} />
    </div>
  );
};

/**
 * Where this hustle's businesses live — the drawer the lead wall files into.
 *
 * Scoped to the hustle, not the gallery: the cards are what the sweep produced
 * here, so the icon they fly into has to be the icon that opens them.
 */
export const filedHref = (projectId: ProjectId) => `/hustles/${projectId}`;

/** Where this hustle's outreach lives — the inbox the built sites are sent from. */
export const pitchHref = (projectId: ProjectId) => `/hustles/${projectId}/pitch`;

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
  const hunt = useHunt(projectId);
  const pathname = usePathname();

  // Marked off the live path rather than a hardcoded route, so Building lights
  // up when you are reading the businesses and This hustle when you are on the
  // build.
  //
  // The endsWith is for the app subdomain: every href here is written without
  // the /app prefix the middleware rewrites to, and which of the two paths
  // reaches this hook is not worth depending on.
  const isActive = (href: string) => pathname === href || pathname.endsWith(href);

  // Thin strokes, one weight heavier where you are — the same call the
  // workspace nav makes. A filled glyph is the heaviest thing in the panel and
  // the pin has already said which page this is.
  const row = (
    label: string,
    href: string,
    Icon: typeof HammerIcon,
    count?: number,
  ): HoverSidebarLinkItem => ({
    label,
    href,
    ...(count === undefined ? {} : { count }),
    icon: (
      <Icon weight={isActive(href) ? "regular" : "light"} className="size-[18px]" />
    ),
  });

  const here = [
    row("This hustle", `/projects/${projectId}`, HammerIcon),
    // Named for what it holds rather than where it goes. Inside a hustle this
    // is the drawer the lead wall files its businesses into, and the gallery
    // it opens is the next thing you build from.
    //
    // Counted with the sweep's own tally of businesses worth pitching, which
    // climbs while the sweep is still running — a drawer filling up is worth
    // seeing from anywhere on the screen.
    row("Building", filedHref(projectId), FolderSimpleIcon, hunt?.found),
    // The other end of the same hustle. Building makes the websites; this is
    // where they are sent to the people they were made for, which is the only
    // step that has ever produced any money.
    row("Pitching", pitchHref(projectId), PaperPlaneTiltIcon),
  ];

  const platform = [
    row("Dashboard", "/dashboard", SquaresFourIcon),
    row("Connections", "/connections", PlugIcon),
  ];

  const support = row("Support", "/support", LifebuoyIcon);

  const link = (item: HoverSidebarLinkItem) => (
    <HoverSidebarLink
      key={item.href}
      link={item}
      active={isActive(item.href)}
      iconRef={item.href === filedHref(projectId) ? fileRef : undefined}
    />
  );

  return (
    <HoverSidebar>
      <HoverSidebarBody
        // milled for the catch-light along the top edge, the same one the
        // workspace panel picks up. overflow-x-hidden because every label in
        // here is still laid out at its open width for a beat while the rail
        // closes, and a horizontal scrollbar under a nav is never the answer.
        className="milled border-sidebar-border/60 justify-between gap-5 overflow-x-hidden"
      >
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Brand name={project?.name} patch={project?.area?.label} />
            <Hype />
          </div>

          <div className="flex flex-col gap-1">
            <GroupLabel>This hustle</GroupLabel>
            {here.map(link)}
          </div>

          <div className="flex flex-col gap-1">
            <GroupLabel>Platform</GroupLabel>
            {platform.map(link)}
          </div>
        </div>

        {/* The quiet end of the rail. Hairlines rather than spacing, so this
            block reads as its own thing instead of the tail of the nav. */}
        <div className="flex flex-col">
          <div className="border-sidebar-border/60 border-t pt-2">{link(support)}</div>

          <div className="border-sidebar-border/60 mt-2 border-t px-0.5 pt-3">
            <UserRow />
          </div>
        </div>
      </HoverSidebarBody>
    </HoverSidebar>
  );
};
