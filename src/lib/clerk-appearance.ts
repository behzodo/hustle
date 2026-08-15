"use client";

import { dark } from "@clerk/themes";

import { siteConfig } from "@/lib/site";
import { useCurrentTheme } from "@/hooks/use-current-theme";

// Clerk renders modals in its own portal, outside the tree our CSS variables
// live in, so they can't inherit the theme the way the rest of the app does.
// Every modal entry point passes this instead.
export const useClerkAppearance = () => {
  const isDark = useCurrentTheme() === "dark";

  return {
    baseTheme: isDark ? dark : undefined,
    variables: {
      // Primary flips to near-white on dark, so the label on a filled button
      // has to flip with it or it's white on white.
      colorPrimary: isDark
        ? siteConfig.colors.primaryDark
        : siteConfig.colors.primary,
      colorTextOnPrimaryBackground: isDark
        ? siteConfig.colors.onPrimaryDark
        : siteConfig.colors.onPrimary,
      borderRadius: "0.75rem",
      fontFamily: "inherit",
    },
  };
};
