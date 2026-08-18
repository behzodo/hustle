"use client";

import type { ProjectId } from "@/modules/projects/types";
import { useProject } from "@/modules/projects/use-projects";
import { describeEmptySweep } from "@/modules/hustles/discovery/lead";
import { useHunt, useLeads } from "@/modules/hustles/use-discovery";
import { ProjectSidebar } from "@/modules/projects/ui/components/project-sidebar";

import { BuildTheatre } from "../components/build-theatre";
import { HustlesBackdrop } from "../components/hustles-backdrop";
import { LeadCard, type CardLead } from "../components/lead-card";

/**
 * What this hustle's sweep found — the Building drawer.
 *
 * Behind the hustle's own rail rather than the workspace shell, because it is
 * a room inside the hustle and not a page beside it: this is where the lead
 * wall throws its shortlist when it is finished, and clicking the icon it flew
 * into has to open the thing it went into. Landing on a different sidebar,
 * with no Building on it, would make the icon a door out of the building.
 *
 * Per hustle rather than pooled across all of them for the same reason the
 * schema has no user-scoped index: a score ranks businesses against others in
 * the same patch, so one list of every town's leads is sorted by a number that
 * means nothing across it.
 */

/** Enough to fill several screens; past this the page is scrolling anyway. */
const PAGE_LIMIT = 120;

const LeadSkeleton = () => (
  <div className="bg-muted/50 aspect-[7/5] animate-pulse rounded-2xl" />
);

export const HustleLeadsView = ({ projectId }: { projectId: ProjectId }) => {
  const project = useProject(projectId);
  const hunt = useHunt(projectId);
  const leads = useLeads(projectId, { limit: PAGE_LIMIT });

  return (
    <div className="bg-background flex h-screen w-full flex-col md:flex-row">
      <ProjectSidebar projectId={projectId} />

      <main className="relative flex-1 overflow-y-auto">
        <HustlesBackdrop />

        <div className="relative flex w-full flex-col gap-8 p-6 md:p-10">
          <div>
            {/* No back link: the rail is the way out, and it is the same rail
                that brought them here. */}
            <h1 className="headline-display font-display text-3xl leading-[1.02] tracking-[-0.03em] text-balance md:text-4xl">
              {project?.name ?? " "}
            </h1>

            <p className="deck font-display text-muted-foreground mt-2 max-w-lg text-balance">
              Every business in this patch with no site of their own. Turn a
              card over for the phone number.
            </p>

            {/* The sweep's own figures, in the same mono the rest of the app
                reports numbers in. Only once there is a sweep to report. */}
            {hunt && hunt.scanned > 0 && (
              <p className="text-muted-foreground mt-4 font-mono text-xs">
                {project?.area?.label}
                {" · "}
                <span className="tabular-nums">{hunt.found}</span> to pitch of{" "}
                <span className="tabular-nums">{hunt.scanned}</span> swept
              </p>
            )}
          </div>

          {/* Above the cards, because it is the thing that changes. The cards
              are a list to browse; this is a run to watch, and it renders
              nothing at all when the patch has no businesses to build. */}
          <BuildTheatre projectId={projectId} />

          {leads === undefined ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <LeadSkeleton key={i} />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="border-border/70 text-muted-foreground mx-auto max-w-lg rounded-2xl border border-dashed p-10 text-center text-sm text-balance">
              {hunt?.status === "running"
                ? "Sweeping this patch now. The businesses land here as they are found."
                : describeEmptySweep(hunt ?? null)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {leads.map((lead) => (
                <LeadCard key={lead._id} lead={lead as CardLead} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
