"use client";

import type { ProjectId } from "@/modules/projects/types";
import { ProjectSidebar } from "@/modules/projects/ui/components/project-sidebar";

import { PitchInbox } from "../components/pitch-inbox";

/**
 * The Pitching room.
 *
 * Behind the hustle's own rail, for the same reason Building is: it is a room
 * inside the hustle, not a page beside it. The businesses on this screen were
 * found by this patch's sweep and the sites were built by this patch's queue,
 * and a score — or an inbox — only means anything against the others in it.
 *
 * No backdrop and no page padding, unlike every other screen in the product.
 * An inbox is a full-height three-column thing that manages its own scrolling,
 * and a page that scrolls around it puts the list header out of reach as soon
 * as somebody reads a long reply.
 */
export const HustlePitchView = ({ projectId }: { projectId: ProjectId }) => (
  <div className="bg-background flex h-screen w-full flex-col md:flex-row">
    <ProjectSidebar projectId={projectId} />

    <main className="min-h-0 min-w-0 flex-1">
      <PitchInbox projectId={projectId} />
    </main>
  </div>
);
