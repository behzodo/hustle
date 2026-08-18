"use client";

/**
 * A rail that widens on hover, from Aceternity's sidebar.
 *
 * Named apart from `@/components/ui/sidebar` on purpose — that one is the
 * shadcn sidebar the whole workspace shell is built on, and the two export
 * the same words for very different things. Installing this over the top of
 * it takes the workspace out entirely.
 *
 * Adapted here: the palette comes from the app's tokens rather than hardcoded
 * neutrals, links are `next/link` so navigation stays client-side, the current
 * route is marked, and the width animation is dropped when the reader has
 * asked for less motion.
 */
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import React, { createContext, useContext, useState } from "react";
import { ListIcon, XIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export interface HoverSidebarLinkItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Live tally shown on the right, the way the workspace nav counts hustles.
   *  Omitted where there is nothing to count. */
  count?: number;
}

interface ContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const HoverSidebarContext = createContext<ContextValue | undefined>(undefined);

export const useHoverSidebar = () => {
  const context = useContext(HoverSidebarContext);
  if (!context) {
    throw new Error("useHoverSidebar must be used within a HoverSidebar");
  }
  return context;
};

export const HoverSidebar = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);
  const reduceMotion = useReducedMotion();

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <HoverSidebarContext.Provider
      value={{ open, setOpen, animate: animate && !reduceMotion }}
    >
      {children}
    </HoverSidebarContext.Provider>
  );
};

export const HoverSidebarBody = (
  props: React.ComponentProps<typeof motion.div>,
) => (
  <>
    <DesktopSidebar {...props} />
    <MobileSidebar {...(props as React.ComponentProps<"div">)} />
  </>
);

const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useHoverSidebar();

  return (
    <motion.div
      className={cn(
        "bg-sidebar text-sidebar-foreground hidden h-full shrink-0 flex-col border-r px-3 py-4 md:flex",
        className,
      )}
      animate={{ width: animate ? (open ? 260 : 64) : 260 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      // Keyboard users never fire the hover, so focus anywhere inside opens it
      // too — otherwise every label is invisible while tabbing.
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useHoverSidebar();

  return (
    <div
      className="bg-sidebar text-sidebar-foreground flex w-full flex-row items-center justify-between border-b px-4 py-2 md:hidden"
      {...props}
    >
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(!open)}
        className="ml-auto"
      >
        <ListIcon className="size-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={cn(
              "bg-sidebar fixed inset-0 z-100 flex h-full w-full flex-col justify-between p-8",
              className,
            )}
          >
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(!open)}
              className="absolute top-8 right-8 z-50"
            >
              <XIcon className="size-5" />
            </button>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const HoverSidebarLink = ({
  link,
  active,
  className,
  iconRef,
}: {
  link: HoverSidebarLinkItem;
  active?: boolean;
  className?: string;
  /**
   * Handle on the icon itself, for anything that needs to point at this link
   * from elsewhere on the screen.
   *
   * The icon rather than the whole row on purpose: the row is 260px wide when
   * the rail is open and 40px when it is shut, so something aiming at its
   * centre would move whenever a cursor passed nearby. The glyph does not.
   */
  iconRef?: React.Ref<HTMLSpanElement>;
}) => {
  const { open, animate } = useHoverSidebar();

  // Everything below the row's own colours is the treatment the workspace nav
  // uses — see components/nav-main.tsx. Two rails in one product marking the
  // current page two different ways reads as two products.
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      title={link.label}
      className={cn(
        "group/sidebar relative flex items-center gap-3 overflow-hidden rounded-lg px-2.5 py-2",
        "text-sm tracking-[-0.011em] transition-colors duration-200",
        "focus-visible:ring-ring outline-none focus-visible:ring-2",
        active
          ? "bg-sidebar-accent/70 text-foreground font-medium"
          : "text-foreground/65 hover:bg-sidebar-accent/60 hover:text-foreground",
        className,
      )}
    >
      {/* A polished pin on the edge and a wash falling away from it. The pin
          is a gradient rather than a flat bar so it catches light like the
          chrome above it, and it grows out of the edge rather than fading in —
          moving between pages should look like one mark sliding, not two
          marks blinking. */}
      <span
        aria-hidden
        className={cn(
          "from-foreground/90 via-foreground/60 to-foreground/25 absolute top-1/2 left-0 w-[2px] -translate-y-1/2 rounded-r-full bg-gradient-to-b transition-all duration-300 ease-out",
          active ? "h-5 opacity-100" : "h-0 opacity-0",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "from-foreground/[0.07] pointer-events-none absolute inset-y-0 left-0 w-3/4 bg-gradient-to-r to-transparent transition-opacity duration-300",
          active ? "opacity-100" : "opacity-0",
        )}
      />

      <span
        ref={iconRef}
        className="relative grid size-5 shrink-0 place-items-center"
      >
        {link.icon}
      </span>

      <motion.span
        animate={{
          // Width, not display: animating display snaps, and a label that is
          // still laid out at 64px is what pushes the icons off the rail.
          width: animate ? (open ? "auto" : 0) : "auto",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="relative overflow-hidden whitespace-pre"
      >
        {link.label}
      </motion.span>

      {/* Collapses with the label rather than sitting on alone: a bare number
          beside a glyph in a 64px rail reads as a badge on the icon. */}
      {link.count !== undefined && link.count > 0 && (
        <motion.span
          animate={{
            width: animate ? (open ? "auto" : 0) : "auto",
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          className={cn(
            "relative ml-auto shrink-0 overflow-hidden text-[11px] font-medium tabular-nums transition-colors",
            active
              ? "text-foreground/65"
              : "text-foreground/35 group-hover/sidebar:text-foreground/55",
          )}
        >
          {link.count}
        </motion.span>
      )}
    </Link>
  );
};
