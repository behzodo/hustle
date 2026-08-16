"use client";

import { useEffect } from "react";

import "./globals.css";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Replaces the root layout entirely, so it can't lean on anything that layout
 * provides — no fonts, no theme provider, no Clerk. Whatever broke may well be
 * one of those, so this page repeats the trace treatment by hand with only
 * Tailwind tokens and system faces. It renders light-only for the same reason:
 * the theme class is applied by a provider that no longer exists.
 */
const GlobalError = ({ error, reset }: Props) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <main className="relative flex min-h-screen items-center justify-center bg-background px-6 py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 bg-[radial-gradient(#dadde2_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
          />

          <div className="relative w-full max-w-xl">
            <p className="eyebrow font-mono text-muted-foreground">
              fatal · app failed to start
            </p>

            <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
              Hustle didn&rsquo;t get off the ground.
            </h1>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
              Something broke before the app could load, so none of the usual
              recovery applies. Reloading is the fix.
              {error.digest ? (
                <>
                  {" "}
                  Quote{" "}
                  <span className="font-mono text-foreground">
                    {error.digest}
                  </span>{" "}
                  if it persists.
                </>
              ) : null}
            </p>

            <div className="mt-9 overflow-hidden rounded-xl border bg-card/60 font-mono text-xs">
              <div className="flex items-center justify-between gap-4 border-b px-4 py-2.5">
                <span className="text-muted-foreground">hustle build</span>
                <span className="truncate text-muted-foreground/60">
                  {error.digest ?? "runtime"}
                </span>
              </div>
              <div className="flex items-center gap-3 border-b px-4 py-2.5">
                <span className="text-muted-foreground/40">+</span>
                <span className="text-muted-foreground">document created</span>
                <span className="ml-auto text-muted-foreground/50">ok</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-primary">&times;</span>
                <span className="font-medium text-foreground">
                  root layout failed
                </span>
                <span className="ml-auto text-primary">fatal</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={reset}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Reload
              </button>
              {/* A plain anchor on purpose: global-error replaces the root
                  layout, so the router this sits above has already failed.
                  next/link would try to soft-navigate with it. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Back to home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
