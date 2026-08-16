"use client";

import type { ProjectId } from "@/modules/projects/types";

import { ProjectSidebar } from "./project-sidebar";

/**
 * A hustle that has never been built: the rail, and an empty room beside it.
 *
 * Deliberately bare. The split panes, the Demo/Code tabs and the composer all
 * belong to a project that has something in it; this is the space before any
 * of that, and it is where the next thing gets built.
 *
 * The sidebar is the exception, because it is the way back out — without it
 * this screen is a dead end with no navigation at all.
 */
export const BlankCanvas = ({ projectId }: { projectId: ProjectId }) => (
  <div className="bg-background flex h-screen w-full flex-col md:flex-row">
    <ProjectSidebar projectId={projectId} />
    <main className="flex-1" />
  </div>
);
