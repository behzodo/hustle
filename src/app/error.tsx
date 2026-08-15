"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/error-state";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
};

const ErrorPage = ({ error, reset }: Props) => {
  useEffect(() => {
    // Surfaces the real stack in dev and in the platform's runtime logs; the
    // digest shown below is all the user gets in production.
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      eyebrow="500 · build failed"
      title="The build stopped short."
      description={
        <>
          This page threw an error while rendering. Running it again clears
          most of them.
          {error.digest ? (
            <>
              {" "}
              If it keeps happening, quote{" "}
              <span className="font-mono text-foreground">{error.digest}</span>
              {" "}— it identifies this exact failure.
            </>
          ) : null}
        </>
      }
      target={error.digest ?? "runtime"}
      steps={[
        { label: "route matched", detail: "ok" },
        { label: "render started", detail: "ok" },
        {
          label: "render failed",
          detail: error.digest ? error.digest.slice(0, 8) : "error",
          failed: true,
        },
      ]}
      actions={[
        { label: "Try again", onClick: reset },
        { label: "Back to home", href: "/", variant: "outline" },
      ]}
    />
  );
};

export default ErrorPage;
