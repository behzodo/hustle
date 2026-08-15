"use client";

import { usePathname } from "next/navigation";

import { appUrl } from "@/lib/site";
import { ErrorState } from "@/components/error-state";

/** Long paths would blow out the trace row; the tail is the useful part. */
const truncate = (path: string, max = 32) =>
  path.length > max ? `${path.slice(0, max - 1)}…` : path;

export const NotFoundView = () => {
  const pathname = usePathname();
  const path = truncate(pathname || "/");

  return (
    <ErrorState
      eyebrow="404 · route not found"
      title="That route was never built."
      description={
        <>
          Nothing here answers to{" "}
          <span className="font-mono text-foreground">{path}</span>. Check the
          address, or head back and build something that does.
        </>
      }
      target={path}
      steps={[
        { label: "request received", detail: "GET" },
        { label: "routes searched", detail: "0 matches" },
        { label: "build halted", detail: "404", failed: true },
      ]}
      actions={[
        { label: "Back to home", href: "/" },
        { label: "Start building", href: appUrl("/"), variant: "outline" },
      ]}
    />
  );
};
