import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

const robots = (): MetadataRoute.Robots => ({
  rules: [
    {
      userAgent: "*",
      allow: "/",
      // Auth-gated or per-user — nothing to index, plenty of crawl budget
      // to waste. Sign-in/sign-up are deliberately left crawlable so their
      // noindex meta tag can actually be read.
      disallow: ["/api/", "/projects/"],
    },
  ],
  sitemap: `${siteConfig.url}/sitemap.xml`,
});

export default robots;
