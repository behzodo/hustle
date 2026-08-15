import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

const manifest = (): MetadataRoute.Manifest => ({
  name: siteConfig.title,
  short_name: siteConfig.name,
  description: siteConfig.description,
  start_url: "/",
  display: "standalone",
  background_color: siteConfig.colors.background,
  theme_color: siteConfig.colors.background,
  icons: [
    { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
    { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
  ],
});

export default manifest;
