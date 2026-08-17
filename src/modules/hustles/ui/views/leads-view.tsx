"use client";

import { useEffect, useState } from "react";
import { ConvexError } from "convex/values";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowSquareOutIcon,
  CrosshairIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
  StopIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ProjectId } from "@/modules/projects/types";
import { useProjects } from "@/modules/projects/use-projects";
import { formatRadius } from "@/modules/hustles/area";
import { describeGap, type WebPresence } from "@/modules/hustles/discovery/lead";
import {
  huntProgress,
  useHunt,
  useHuntQuote,
  useLeads,
  useStartHunt,
  useStopHunt,
} from "@/modules/hustles/use-discovery";

/**
 * A look at what the discovery sweep actually turned up.
 *
 * A preview screen, not the finished feature: the real place for this is
 * inside a hustle, next to the sweep animation. It exists on its own for now
 * because the engine landed before the screen it belongs to, and a list of
 * real businesses read off a real map is the only way to tell whether the
 * search terms and the website verdict are any good.
 *
 * Everything here is live. The sweep writes leads from a scheduled action on
 * the server and the table fills in underneath as it goes, without a refresh
 * and without polling.
 */

const EM_DASH = "—";

/** Businesses with a gap first, so the list opens on the useful half. */
const PAGE_SIZE = 200;

const StatCell = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="eyebrow text-muted-foreground text-[10px]">{label}</span>
    <span className="headline-figure font-display text-xl leading-none tabular-nums">
      {value}
    </span>
  </div>
);

/**
 * How worth pitching a lead is, as a bar rather than a bare number.
 *
 * The figure on its own means nothing without the ones above and below it —
 * the bar is what makes the ordering legible at a glance.
 */
const Score = ({ value }: { value: number }) => (
  <div className="flex items-center gap-2">
    <div className="bg-foreground/10 h-1 w-16 overflow-hidden rounded-full">
      <div className="bg-foreground h-full rounded-full" style={{ width: `${value}%` }} />
    </div>
    <span className="text-muted-foreground w-6 text-right font-mono text-[11px] tabular-nums">
      {value}
    </span>
  </div>
);

/** The verdict, weighted so "no website at all" reads loudest. */
const Gap = ({
  presence,
  socialKind,
}: {
  presence: WebPresence;
  socialKind?: string;
}) => (
  <Badge
    variant={
      presence === "none" ? "default" : presence === "social" ? "secondary" : "outline"
    }
    className="rounded-full font-normal"
  >
    {describeGap(presence, socialKind)}
  </Badge>
);

export const LeadsView = () => {
  const projects = useProjects();
  const [projectId, setProjectId] = useState<ProjectId | null>(null);
  const [includeCovered, setIncludeCovered] = useState(false);

  // The picker defaults to the most recent hustle rather than making the user
  // choose one before the screen shows anything.
  useEffect(() => {
    if (projectId === null && projects && projects.length > 0) {
      setProjectId(projects[0]._id);
    }
  }, [projects, projectId]);

  const hunt = useHunt(projectId as ProjectId);
  const quote = useHuntQuote(projectId as ProjectId);
  const leads = useLeads(projectId as ProjectId, { limit: PAGE_SIZE, includeCovered });

  const startHunt = useStartHunt();
  const stopHunt = useStopHunt();
  const [starting, setStarting] = useState(false);

  const project = projects?.find((candidate) => candidate._id === projectId);
  const running = hunt?.status === "running";
  const progress = huntProgress(hunt ?? null);

  const start = async () => {
    if (projectId === null) return;

    setStarting(true);
    try {
      await startHunt({ projectId });
    } catch (error) {
      // The mutation's own message is the useful one: no patch drawn, or no
      // room in the plan. A generic toast would hide which.
      toast.error(
        error instanceof ConvexError
          ? String((error.data as { message?: string })?.message ?? error.message)
          : "Could not start the sweep.",
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted-foreground">Preview</p>
          <h1 className="headline-display font-display mt-1 text-3xl leading-[1.02] tracking-[-0.03em] text-balance md:text-4xl">
            What the sweep found
          </h1>
          <p className="deck font-display text-muted-foreground mt-2 text-balance">
            Every business in the patch, and whether anyone has built them a
            website yet.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={projectId ?? undefined}
            onValueChange={(value) => setProjectId(value as ProjectId)}
          >
            <SelectTrigger className="h-11 w-[15rem] rounded-xl">
              <SelectValue placeholder="Pick a hustle" />
            </SelectTrigger>
            <SelectContent>
              {projects?.map((candidate) => (
                <SelectItem key={candidate._id} value={candidate._id}>
                  {candidate.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {running ? (
            <Button
              variant="outline"
              className="h-11 rounded-xl px-5"
              onClick={() => hunt && stopHunt({ huntId: hunt._id })}
            >
              <StopIcon className="size-4" weight="fill" />
              Stop
            </Button>
          ) : (
            <Button
              className="h-11 rounded-xl px-5"
              disabled={projectId === null || starting || !project?.area}
              onClick={start}
            >
              <CrosshairIcon className="size-4" weight="bold" />
              {hunt ? "Sweep again" : "Start hunting"}
            </Button>
          )}
        </div>
      </div>

      {/* The patch being searched, and what the search costs. Both are shown
          before the button is pressed — a sweep spends real money, and a
          screen that only reveals the bill afterwards is hiding it. */}
      <div className="bg-card flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <MapPinIcon className="text-muted-foreground size-5 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {project?.area?.label ?? "No patch drawn"}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {project?.area
                ? `${formatRadius(project.area.radiusM)} around the pin` +
                  (project.area.polygon ? ", traced" : "")
                : "Draw one in the new-hustle wizard to search here."}
            </p>
          </div>
        </div>

        {hunt ? (
          <>
            <StatCell label="Scanned" value={String(hunt.scanned)} />
            <StatCell label="No site" value={String(hunt.found)} />
            <StatCell
              label="Hit rate"
              value={hunt.scanned === 0 ? EM_DASH : `${Math.round((hunt.found / hunt.scanned) * 100)}%`}
            />
            <StatCell label="Requests" value={String(hunt.requests)} />
            <StatCell
              label="Status"
              value={running ? `${Math.round(progress * 100)}%` : hunt.status}
            />
          </>
        ) : quote && quote.searches > 0 ? (
          <>
            <StatCell label="Searches" value={String(quote.searches)} />
            <StatCell label="Requests" value={String(quote.requests)} />
            <StatCell label="Tiles" value={String(quote.tiles)} />
            <p className="text-muted-foreground max-w-xs text-xs">
              Will search {quote.terms.join(", ")}.
              {quote.skipped.length > 0 && (
                <>
                  {" "}
                  <span className="text-foreground">
                    No room for {quote.skipped.join(", ")}
                  </span>{" "}
                  — this patch is wide enough that the request budget runs out
                  first.
                </>
              )}
            </p>
          </>
        ) : null}
      </div>

      {/* A sweep in flight. The bar is the plan's cursor, not a guess. */}
      {running && (
        <div className="bg-foreground/10 h-0.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-foreground h-full rounded-full transition-[width] duration-500"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        </div>
      )}

      {hunt?.status === "failed" && (
        <div className="border-destructive/40 bg-destructive/5 flex items-start gap-3 rounded-xl border p-4">
          <WarningIcon className="text-destructive mt-0.5 size-4 shrink-0" weight="fill" />
          <div className="min-w-0">
            <p className="text-sm font-medium">The sweep stopped early</p>
            <p className="text-muted-foreground mt-0.5 font-mono text-xs break-words">
              {hunt.error}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Everything it found before that point is below.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          {leads === undefined
            ? "Loading…"
            : `${leads.length} ${includeCovered ? "businesses" : "prospects"}`}
          {hunt?.finishedAt !== undefined &&
            ` · swept ${formatDistanceToNow(hunt.finishedAt, { addSuffix: true })}`}
        </p>

        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <Switch checked={includeCovered} onCheckedChange={setIncludeCovered} />
          Show the ones that already have a site
        </label>
      </div>

      <div className="bg-card overflow-hidden rounded-2xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Business</TableHead>
              <TableHead>What they have</TableHead>
              <TableHead className="text-right">Reviews</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Found as</TableHead>
              <TableHead className="pr-4">Worth pitching</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {leads?.map((lead) => (
              <TableRow key={lead._id}>
                <TableCell className="max-w-[18rem] pl-4">
                  <p className="truncate font-medium">{lead.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {lead.address ?? EM_DASH}
                  </p>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    <Gap presence={lead.presence} socialKind={lead.socialKind} />
                    {lead.website && (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Open ${lead.name}'s page`}
                      >
                        <ArrowSquareOutIcon className="size-3.5" />
                      </a>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-right">
                  {lead.reviewCount === undefined ? (
                    <span className="text-muted-foreground">{EM_DASH}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      {lead.rating !== undefined && (
                        <>
                          <StarIcon className="text-foreground/60 size-3" weight="fill" />
                          {lead.rating.toFixed(1)}
                        </>
                      )}
                      <span className="text-muted-foreground">({lead.reviewCount})</span>
                    </span>
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground max-w-[12rem] truncate">
                  {lead.categories[0] ?? EM_DASH}
                </TableCell>

                <TableCell className={cn(lead.phone ? "" : "text-muted-foreground")}>
                  {lead.phone ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <PhoneIcon className="size-3" />
                      {lead.phone}
                    </span>
                  ) : (
                    EM_DASH
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground font-mono text-xs">
                  {lead.term}
                </TableCell>

                <TableCell className="pr-4">
                  <Score value={lead.score} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {leads?.length === 0 && (
          <div className="text-muted-foreground p-10 text-center text-sm">
            {hunt === null || hunt === undefined
              ? "Nothing swept yet. Press start and the businesses appear here as they are found."
              : running
                ? "Sweeping. The first results land in a few seconds."
                : includeCovered
                  ? "The sweep found nothing in this patch."
                  : "Every business in this patch already has a website."}
          </div>
        )}
      </div>
    </div>
  );
};
