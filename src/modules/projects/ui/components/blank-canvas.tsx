"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import type { ProjectId } from "@/modules/projects/types";
import { useProject } from "@/modules/projects/use-projects";
import { useHunt, useStartHunt } from "@/modules/hustles/use-discovery";

import { HowItWorks } from "./how-it-works";
import { LeadWall } from "./lead-wall";
import { ProjectSidebar } from "./project-sidebar";
import { ProjectBackdrop } from "./project-backdrop";

/**
 * A hustle that has never been built.
 *
 * The screen runs the product's own loop once, in order, and each scene leaves
 * when it has nothing left to say:
 *
 *   sweeping   the explainer, with the discover act drawing the real sweep
 *   swept      the wall of businesses it found, cut down to the shortlist
 *   filed      the shortlist flies into the rail, and the explainer comes back
 *              on the build act — the step the user is now one prompt away from
 *
 * That order is the argument. An explainer that stayed up next to the results
 * would be a diagram competing with the thing it described, so it goes when
 * the businesses arrive. It returns only once they have been put away, by
 * which point it is no longer explaining the sweep — it is showing what the
 * next prompt does.
 *
 * The sidebar is the way back out; without it this screen is a dead end with
 * no navigation at all. It is also where the leads are filed, which is the
 * other reason it cannot be left off.
 */
export const BlankCanvas = ({ projectId }: { projectId: ProjectId }) => {
  const still = Boolean(useReducedMotion());
  const project = useProject(projectId);
  const hunt = useHunt(projectId);
  const startHunt = useStartHunt();

  const started = useRef(false);

  /**
   * Sweep the patch the first time this hustle is opened.
   *
   * Guarded on there being no hunt at all rather than on none *running*: a
   * sweep costs real money per search, and a guard that only checked for a
   * running one would bill the whole patch again every time someone came back
   * to look at their own leads. One hustle, one sweep, until it is asked for
   * again.
   */
  useEffect(() => {
    if (started.current) return;
    // Undefined means the subscription has not answered yet — not "none".
    if (hunt === undefined || project === undefined) return;
    if (hunt !== null || !project?.area) return;

    started.current = true;
    // Deliberately not retried on failure: the action records why it failed
    // on the hunt row, and a retry loop here would spend credits explaining
    // that it cannot spend credits.
    void startHunt({ projectId }).catch(() => {});
  }, [hunt, project, projectId, startHunt]);

  const loading = hunt === undefined || project === undefined;
  const swept = !loading && hunt !== null && hunt.status !== "running";

  const [filed, setFiled] = useState(false);
  const onFiled = useCallback(() => setFiled(true), []);

  const stage = loading ? null : !swept ? "explainer" : filed ? "build" : "wall";

  /** Where the wall throws its shortlist when it is done with it. */
  const fileRef = useRef<HTMLSpanElement>(null);

  // The container's layout has to follow whichever child is mounted, and with
  // `mode="wait"` the next scene does not mount until the last has finished
  // leaving. Flipping on the stage alone would yank the frame to the top of
  // the screen while the explainer was still fading out.
  const [topAligned, setTopAligned] = useState(false);
  const settled = useRef(false);

  useEffect(() => {
    if (loading || settled.current) return;
    settled.current = true;

    // Re-opening a hustle that was swept in an earlier session: there is no
    // explainer to fade, so the wall takes the layout straight away.
    if (swept) setTopAligned(true);
  }, [loading, swept]);

  return (
    <div className="bg-background flex h-screen w-full flex-col md:flex-row">
      <ProjectSidebar projectId={projectId} fileRef={fileRef} />

      {/* The backdrop belongs to the explainer, not the screen. While the wall
          is up the canvas is nothing but the sidebar and the businesses. */}
      <main
        className={cn(
          "relative flex flex-1 overflow-y-auto p-6 md:p-10",
          topAligned ? "items-start justify-start" : "items-center justify-center",
        )}
      >
        {!topAligned && <ProjectBackdrop />}

        <AnimatePresence
          mode="wait"
          onExitComplete={() => setTopAligned(stage === "wall")}
        >
          {stage === null ? null : stage === "wall" ? (
            <motion.div
              key="wall"
              className="relative w-full"
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <LeadWall
                projectId={projectId}
                areaLabel={project?.area?.label}
                fileRef={fileRef}
                onFiled={onFiled}
              />
            </motion.div>
          ) : (
            <motion.div
              key={stage}
              className="relative"
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              // Not a plain fade: the frame pulls back and softens, so the
              // explainer reads as being put away rather than switched off.
              exit={
                still
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.94, filter: "blur(10px)" }
              }
              transition={{ duration: stage === "build" ? 0.45 : 0.55, ease: [0.4, 0, 1, 1] }}
            >
              {/* Coming back after the leads have been filed, the sweep is
                  finished and re-enacting it would be the screen miming work
                  it already did — so this showing opens on the build. */}
              <HowItWorks
                projectId={projectId}
                startAt={stage === "build" ? "build" : "hunt"}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
