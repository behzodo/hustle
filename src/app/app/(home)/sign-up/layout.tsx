import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign up",
  description: `Create a free ${siteConfig.name} account and start building apps by chatting with AI.`,
  alternates: { canonical: "/sign-up" },
  robots: { index: false, follow: true },
};

const Layout = ({ children }: { children: React.ReactNode }) => children;

export default Layout;
