"use client";

import { useEffect, useRef, useState } from "react";
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
 * The screen has two states and it moves between them once. While the patch
 * is being swept it shows the loop the product runs, with the discover act
 * drawing the sweep that is actually happening. When the sweep finishes the
 * whole explainer leaves and the businesses it found take the canvas.
 *
 * That order is the argument. An explainer that stayed up next to the results
 * would be a diagram competing with the thing it described; the results are
 * the thing, so at the moment they exist the diagram has no job left.
 *
 * The sidebar is the way back out; without it this screen is a dead end with
 * no navigation at all.
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

  // The container's layout has to follow whichever child is mounted, and with
  // `mode="wait"` the wall does not mount until the explainer has finished
  // leaving. Flipping on `swept` alone would yank the frame to the top of the
  // screen while it was still fading out.
  const [wallLayout, setWallLayout] = useState(false);
  const settled = useRef(false);

  useEffect(() => {
    if (loading || settled.current) return;
    settled.current = true;

    // Re-opening a hustle that was swept in an earlier session: there is no
    // explainer to fade, so the wall takes the layout straight away.
    if (swept) setWallLayout(true);
  }, [loading, swept]);

  return (
    <div className="bg-background flex h-screen w-full flex-col md:flex-row">
      <ProjectSidebar projectId={projectId} />

      {/* The backdrop belongs to the explainer, not the screen. Once the wall
          is up the canvas is nothing but the sidebar and the businesses. */}
      <main
        className={cn(
          "relative flex flex-1 overflow-y-auto p-6 md:p-10",
          wallLayout ? "items-start justify-start" : "items-center justify-center",
        )}
      >
        {!wallLayout && <ProjectBackdrop />}

        <AnimatePresence mode="wait" onExitComplete={() => setWallLayout(true)}>
          {loading ? null : swept ? (
            <motion.div
              key="wall"
              className="relative w-full"
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <LeadWall projectId={projectId} areaLabel={project?.area?.label} />
            </motion.div>
          ) : (
            <motion.div
              key="explainer"
              className="relative"
              // Not a plain fade: the frame pulls back and softens, so the
              // explainer reads as being put away rather than switched off.
              exit={
                still
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.94, filter: "blur(10px)" }
              }
              transition={{ duration: 0.55, ease: [0.4, 0, 1, 1] }}
            >
              <HowItWorks projectId={projectId} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
