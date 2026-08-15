"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface TraceStep {
  label: string;
  detail?: string;
  /** The step that stopped the run. Exactly one per trace. */
  failed?: boolean;
};

export interface ErrorAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline";
};

interface Props {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  /** Shown on the right of the trace header — the thing being built. */
  target: string;
  steps: TraceStep[];
  actions: ErrorAction[];
};

// The whole page assembles in one sequence rather than each block animating
// on its own schedule. Every delay below is a step in that single run.
// Kept under ~1.2s end to end: the actions animate in last, and anything
// slower leaves someone reaching for "Back to home" waiting on the sequence.
const BASE_DELAY = 60;
const STEP_DELAY = 110;
// The pause before the failure lands — a build that fails instantly reads
// like a static graphic, one that hesitates reads like it was running.
const FAILURE_PAUSE = 180;

const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

/**
 * Error pages render as a build that stopped. Hustle's product loop is
 * "describe it, watch the agent build it" — so a page that isn't here is a
 * route that was never built, and the trace is the honest way to say so.
 */
export const ErrorState = ({
  eyebrow,
  title,
  description,
  target,
  steps,
  actions,
}: Props) => {
  const stepsStart = BASE_DELAY * 4;
  // Delays accumulate so the pause before a failure pushes back everything
  // after it, rather than only offsetting the failing line itself.
  let elapsed = stepsStart;
  const timings = steps.map((step) => {
    if (step.failed) elapsed += FAILURE_PAUSE;
    const at = elapsed;
    elapsed += STEP_DELAY;
    return at;
  });

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 py-16">
      {/* Same dot canvas as the workspace and pricing page, so an error still
          reads as somewhere inside the product. */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 bg-background" />
      <div
        aria-hidden="true"
        className="dot-drift fixed inset-0 -z-10 bg-[radial-gradient(#dadde2_1px,transparent_1px)] dark:bg-[radial-gradient(#393e4a_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />

      <div className="w-full max-w-xl">
        <p
          className="build-in eyebrow font-mono text-muted-foreground"
          style={delay(0)}
        >
          {eyebrow}
        </p>

        <h1
          className="build-in headline-display font-display mt-4 text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl"
          style={delay(BASE_DELAY)}
        >
          {title}
        </h1>

        <p
          className="build-in mt-4 max-w-md text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base"
          style={delay(BASE_DELAY * 2)}
        >
          {description}
        </p>

        <div
          className="build-in mt-9 overflow-hidden rounded-xl border bg-card/60 font-mono text-xs backdrop-blur-sm"
          style={delay(BASE_DELAY * 3)}
        >
          <div className="flex items-center justify-between gap-4 border-b px-4 py-2.5">
            <span className="text-muted-foreground">hustle build</span>
            <span className="truncate text-muted-foreground/60">{target}</span>
          </div>

          <ul className="divide-y divide-border/60">
            {steps.map((step, index) => (
              <li
                key={step.label}
                className="build-in flex items-center gap-3 px-4 py-2.5"
                style={delay(timings[index])}
              >
                {step.failed ? (
                  <X className="size-3.5 shrink-0 text-primary" />
                ) : (
                  <Check className="size-3.5 shrink-0 text-muted-foreground/40" />
                )}
                <span
                  className={cn(
                    "truncate",
                    step.failed
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                {step.detail && (
                  <span
                    className={cn(
                      "ml-auto shrink-0 tabular-nums",
                      step.failed
                        ? "text-primary"
                        : "text-muted-foreground/50"
                    )}
                  >
                    {step.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {/* The only thing still moving once the run has stopped. */}
          <div
            className="build-in flex items-center gap-3 px-4 py-2.5"
            style={delay(elapsed)}
          >
            <span
              aria-hidden="true"
              className="trace-caret inline-block h-3.5 w-[7px] bg-foreground/60"
            />
          </div>
        </div>

        <div
          className="build-in mt-8 flex flex-wrap items-center gap-3"
          style={delay(elapsed + STEP_DELAY)}
        >
          {actions.map((action) =>
            action.href ? (
              <Button
                key={action.label}
                asChild
                variant={action.variant ?? "default"}
              >
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ) : (
              <Button
                key={action.label}
                variant={action.variant ?? "default"}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )
          )}
        </div>
      </div>
    </main>
  );
};
