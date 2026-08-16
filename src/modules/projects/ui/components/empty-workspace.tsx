"use client";

interface Props {
  /** "preview" waits on a built site, "code" on the files behind it. */
  pane: "preview" | "code";
}

/**
 * The right-hand pane between the first prompt and the first result.
 *
 * A hustle with no messages never reaches here — that opens on the blank
 * canvas instead. This is the gap while a build runs, so it says only that
 * much and stays out of the way.
 */
export const EmptyWorkspace = ({ pane }: Props) => (
  <div className="flex h-full items-center justify-center p-6">
    <p className="text-muted-foreground text-sm">
      {pane === "preview"
        ? "The site opens here once the build finishes."
        : "The files show here once the build finishes."}
    </p>
  </div>
);
