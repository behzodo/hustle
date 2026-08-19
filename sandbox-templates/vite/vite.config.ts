import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The dev server runs inside a sandbox and is reached through Daytona's
    // preview proxy. On the default 127.0.0.1 it is unreachable from outside
    // the container and the preview URL returns a connection refused.
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // The proxy serves the app from a generated hostname, which Vite's own
    // host check rejects as a DNS-rebinding attempt.
    allowedHosts: true,
  },
  build: { outDir: "dist" },
});
