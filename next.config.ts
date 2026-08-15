import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The landing page's photography is served from Unsplash. next/image
    // rejects any remote host that isn't listed here.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
