import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A build and a running dev server share `.next` and trample each other —
  // the symptom is "Failed to collect page data" on a different page each run,
  // which reads like a code fault and is not one. Setting NEXT_DIST_DIR gives
  // a verification build its own directory so both can run at once.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
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
