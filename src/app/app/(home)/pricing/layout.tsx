import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";

// The page itself is a client component (Clerk's PricingTable needs the
// theme at runtime), so its metadata lives here.
export const metadata: Metadata = {
  title: "Pricing",
  description:
    `Simple credit-based pricing for ${siteConfig.name}. One credit builds one app — start free, upgrade to Pro for more monthly credits.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: `Pricing · ${siteConfig.name}`,
    description:
      "One credit builds one app. Start free, upgrade to Pro for more monthly credits.",
    url: `${siteConfig.url}/pricing`,
  },
};

const Layout = ({ children }: { children: React.ReactNode }) => children;

export default Layout;
