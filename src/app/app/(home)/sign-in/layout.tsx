import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${siteConfig.name} to keep building your apps.`,
  alternates: { canonical: "/sign-in" },
  // Nothing here is worth a search result, and indexing auth screens
  // splits ranking signals away from the landing page.
  robots: { index: false, follow: true },
};

const Layout = ({ children }: { children: React.ReactNode }) => children;

export default Layout;
