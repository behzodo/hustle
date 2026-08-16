"use client";

import { IconContext } from "@phosphor-icons/react";

/**
 * One weight for every Phosphor icon under the workspace.
 *
 * Light rather than regular: the display face is a high-contrast serif with
 * fine hairlines, and a 2px-stroke icon sitting beside it reads heavier than
 * the type it labels. Set once here so no call site has to remember.
 *
 * Size is left to Tailwind — the `size-4` classes already on every icon win
 * over the width/height attributes Phosphor writes.
 */
export const IconProvider = ({ children }: { children: React.ReactNode }) => (
  <IconContext.Provider value={{ weight: "light" }}>
    {children}
  </IconContext.Provider>
);
