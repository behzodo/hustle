"use client";

import type { ProjectId } from "@/modules/projects/types";
import { ProjectSidebar } from "@/modules/projects/ui/components/project-sidebar";

/**
 * The Switchboard — the phone half of the level 2 offer.
 *
 * Behind the hustle's own rail, for the same reason Building and Pitching are:
 * it is a room inside the hustle rather than a page beside it. The shops whose
 * phones this answers are the businesses this patch swept, this patch built for
 * and this patch sold to, and a call only means anything next to the lead it
 * came from.
 *
 * Empty on purpose. The route and its place in the rail are what is settled
 * here; the AI that picks up is not built yet.
 */
export const HustleSwitchboardView = ({ projectId }: { projectId: ProjectId }) => (
  <div className="bg-background flex h-screen w-full flex-col md:flex-row">
    <ProjectSidebar projectId={projectId} />

    <main className="min-h-0 min-w-0 flex-1" />
  </div>
);
