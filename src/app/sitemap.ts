import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

// Only the two publicly indexable marketing routes. Sign-in/sign-up are
// public but have no standalone value, and projects are auth-gated.
const sitemap = (): MetadataRoute.Sitemap => [
  {
    url: siteConfig.url,
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    url: `${siteConfig.url}/pricing`,
    changeFrequency: "monthly",
    priority: 0.8,
  },
  // Low priority, but they carry the consent links shown at sign-up, so
  // they should stay indexable rather than orphaned.
  {
    url: `${siteConfig.url}/privacy`,
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    url: `${siteConfig.url}/terms`,
    changeFrequency: "yearly",
    priority: 0.3,
  },
];

export default sitemap;
