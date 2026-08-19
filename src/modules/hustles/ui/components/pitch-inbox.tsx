"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  ProhibitIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ProjectId } from "@/modules/projects/types";
import { NoAddressList } from "./no-address-list";
import {
  useEditPitch,
  useMarkPitchRead,
  usePitchProgress,
  usePitches,
  useSetPitchStatus,
} from "@/modules/hustles/use-pitches";

/**
 * The inbox.
 *
 * Built to the shape of shadcn's sidebar-09 — a narrow rail, a column of
 * messages beside it, a reading pane taking the rest — because that shape is
 * what every person alive already knows how to use, and this screen is asking
 * them to read a few hundred emails they did not write.
 *
 * Two things are deliberately different from a mail client.
 *
 * The reading pane shows the website next to the email. The pitch is a link
 * and a sentence about a page; judging whether it is any good means looking at
 * the page, and a screen that makes somebody open a tab to do that is a screen
 * where nobody checks.
 *
 * And nothing here sends by itself. Drafting writes; sending is a separate
 * button with its own confirmation, because the row under the cursor is a real
 * business with a real person reading it, and there is no unsend.
 */

/** How a pitch looks, by where it has got to. */
const LOOKS: Record<
  string,
  { label: string; dot: string; chip: string }
> = {
  drafted: {
    label: "Draft",
    dot: "bg-amber-500",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  queued: {
    label: "Queued",
    dot: "bg-sky-500",
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  sending: {
    label: "Sending",
    dot: "bg-sky-500 animate-pulse",
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  sent: {
    label: "Sent",
    dot: "bg-muted-foreground/50",
    chip: "border-border bg-muted/60 text-muted-foreground",
  },
  replied: {
    label: "Replied",
    dot: "bg-emerald-500",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  won: {
    label: "Won",
    dot: "bg-emerald-600",
    chip: "border-emerald-600/40 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
  },
  lost: {
    label: "Lost",
    dot: "bg-muted-foreground/30",
    chip: "border-border bg-muted/40 text-muted-foreground",
  },
  failed: {
    label: "Blocked",
    dot: "bg-red-500",
    chip: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  },
};

const look = (status: string) => LOOKS[status] ?? LOOKS.sent;

const when = (at: number) =>
  formatDistanceToNow(new Date(at), { addSuffix: true }).replace("about ", "");

/** The first line or two of the email, for the row. */
const teaser = (body: string) =>
  body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("http"))
    .slice(0, 2)
    .join(" ");

type Pitch = NonNullable<ReturnType<typeof usePitches>>[number];

/* -------------------------------------------------------------------------- *
 * The list.
 * -------------------------------------------------------------------------- */

const Row = ({
  pitch,
  active,
  onPick,
}: {
  pitch: Pitch;
  active: boolean;
  onPick: () => void;
}) => {
  const style = look(pitch.status);
  const unread = !pitch.readAt;

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "border-border/60 hover:bg-muted/50 flex w-full flex-col items-start gap-1.5 border-b p-4 text-left text-sm leading-tight transition-colors last:border-b-0",
        active && "bg-muted/70",
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            unread ? "text-foreground font-medium" : "text-muted-foreground",
          )}
        >
          {pitch.business}
        </span>
        <span className="text-muted-foreground/70 shrink-0 font-mono text-[10px] tabular-nums">
          {when(pitch.updatedAt)}
        </span>
      </div>

      <span className={cn("w-full truncate", unread ? "font-medium" : "")}>
        {pitch.subject}
      </span>

      <span className="text-muted-foreground line-clamp-2 w-full text-xs">
        {/* The reply, once there is one — it is the thing that changed, and a
            row still teasing our own email hides the only new information on
            the screen. */}
        {pitch.thread.at(-1)?.side === "them"
          ? pitch.thread.at(-1)!.text.slice(0, 160)
          : teaser(pitch.body)}
      </span>
    </button>
  );
};

/* -------------------------------------------------------------------------- *
 * The reading pane.
 * -------------------------------------------------------------------------- */

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline gap-2 text-xs">
    <span className="text-muted-foreground/70 w-12 shrink-0">{label}</span>
    <span className="text-foreground/90 min-w-0 truncate font-mono">{value}</span>
  </div>
);

const Reader = ({ pitch }: { pitch: Pitch }) => {
  const edit = useEditPitch();
  const setStatus = useSetPitchStatus();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ subject: pitch.subject, body: pitch.body });
  const [saving, setSaving] = useState(false);

  const style = look(pitch.status);
  const editable = pitch.status === "drafted" || pitch.status === "failed";
  const reply = pitch.thread.filter((m) => m.side === "them").at(-1);

  const save = async () => {
    setSaving(true);

    try {
      await edit({ pitchId: pitch._id, subject: draft.subject, body: draft.body });
      setEditing(false);
      toast.success("Saved");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not save that");
    } finally {
      setSaving(false);
    }
  };

  const mark = async (status: "won" | "lost") => {
    await setStatus({ pitchId: pitch._id, status });
    toast.success(status === "won" ? "Marked won" : "Marked lost");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---- who, and where it stands ---- */}
      <header className="border-border/60 flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display headline-display truncate text-lg tracking-[-0.02em]">
              {pitch.business}
            </h2>
            <Badge variant="outline" className={cn("shrink-0 text-[10px]", style.chip)}>
              {style.label}
            </Badge>
          </div>

          <div className="mt-2 space-y-1">
            <Field label="To" value={pitch.to} />
            <Field label="Site" value={pitch.siteUrl.replace("https://", "")} />
            {pitch.sentAt && <Field label="Sent" value={when(pitch.sentAt)} />}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {editable && (
            <Button
              size="sm"
              variant={editing ? "default" : "outline"}
              onClick={() => (editing ? void save() : setEditing(true))}
              disabled={saving}
            >
              <PencilSimpleIcon className="size-4" />
              {editing ? "Save" : "Edit"}
            </Button>
          )}

          {(pitch.status === "sent" || pitch.status === "replied") && (
            <>
              <Button size="sm" variant="outline" onClick={() => void mark("won")}>
                <CheckCircleIcon className="size-4" />
                Won
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void mark("lost")}>
                <ProhibitIcon className="size-4" />
                Lost
              </Button>
            </>
          )}

          <Button size="sm" variant="ghost" asChild>
            <a href={pitch.siteUrl} target="_blank" rel="noopener noreferrer">
              <ArrowSquareOutIcon className="size-4" />
              Open site
            </a>
          </Button>
        </div>
      </header>

      {/* ---- the email, and the page it is about ---- */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 p-5">
          {pitch.error && (
            <div className="mb-4 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300">
              <WarningCircleIcon className="mt-px size-4 shrink-0" />
              <span>{pitch.error}</span>
            </div>
          )}

          {reply && (
            // Above our own email, not below it. The reply is why the row moved
            // to the top of the list, and it is what a person opened this to
            // read — putting it under a hundred and ten words they already
            // wrote is putting it where nobody looks.
            <div className="border-border/60 bg-muted/40 mb-5 rounded-xl border p-4">
              <p className="eyebrow text-muted-foreground/70 mb-2">
                They replied · {when(reply.at)}
              </p>
              <p className="text-sm whitespace-pre-wrap">{reply.text}</p>
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              <Input
                value={draft.subject}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, subject: event.target.value }))
                }
                className="font-medium"
              />
              <Textarea
                value={draft.body}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, body: event.target.value }))
                }
                rows={16}
                className="font-mono text-xs leading-relaxed"
              />
              <p className="text-muted-foreground text-xs">
                Your address, your name on it. Nothing checks this again after
                you save.
              </p>
            </div>
          ) : (
            <article className="max-w-prose">
              <p className="mb-4 font-medium">{pitch.subject}</p>
              <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap">
                {pitch.body}
              </p>
            </article>
          )}

          {/* What the checker caught, kept rather than thrown away — a check
              that fired and was overruled is still the only record it fired. */}
          {pitch.write && pitch.write.problems.length > 0 && (
            <details className="border-border/60 mt-6 rounded-xl border p-3">
              <summary className="cursor-pointer text-xs font-medium">
                The checker had {pitch.write.problems.length} note
                {pitch.write.problems.length === 1 ? "" : "s"}
              </summary>
              <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
                {pitch.write.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </details>
          )}

          {pitch.write && (
            <p className="text-muted-foreground/60 mt-4 font-mono text-[10px]">
              {pitch.write.provider} · {pitch.write.tokens} tokens ·{" "}
              {pitch.write.seconds}s
              {pitch.write.rewrites > 0 && ` · rewritten ${pitch.write.rewrites}×`}
            </p>
          )}
        </div>

        {/* The page itself. Sandboxed and inert — this is a look, not a visit. */}
        <aside className="border-border/60 hidden min-w-0 border-l p-5 lg:block">
          <p className="eyebrow text-muted-foreground/70 mb-3">What they will see</p>
          <div className="border-border/60 bg-background relative aspect-[3/4] overflow-hidden rounded-xl border">
            <iframe
              src={pitch.siteUrl}
              title={pitch.business}
              loading="lazy"
              tabIndex={-1}
              sandbox=""
              className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
              style={{ width: 1280, height: 1700, transform: "scale(0.28)" }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- *
 * The screen.
 * -------------------------------------------------------------------------- */

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-baseline gap-1.5">
    <span className="font-mono text-sm tabular-nums">{value}</span>
    <span className="text-muted-foreground/70 text-[11px]">{label}</span>
  </div>
);

export const PitchInbox = ({ projectId }: { projectId: ProjectId }) => {
  const pitches = usePitches(projectId);
  const progress = usePitchProgress(projectId);
  const markRead = useMarkPitchRead();

  const [picked, setPicked] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  // Which of the two lists the column is showing. A tab rather than a second
  // screen, because they are two halves of one question — who has been written
  // to, and who cannot be — and the answer to the second is most of the patch.
  const [tab, setTab] = useState<"pitches" | "stuck">("pitches");

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();

    return (pitches ?? []).filter((pitch) => {
      if (unreadOnly && pitch.readAt) return false;
      if (!term) return true;

      return (
        pitch.business.toLowerCase().includes(term) ||
        pitch.subject.toLowerCase().includes(term) ||
        pitch.to.toLowerCase().includes(term)
      );
    });
  }, [pitches, search, unreadOnly]);

  const open = shown.find((pitch) => pitch._id === picked) ?? shown[0];

  const run = async (action: "draft" | "send" | "replies") => {
    // Sending is the one thing on this screen that cannot be undone, so it is
    // the one thing that asks. Everything else writes to our own database.
    if (action === "send") {
      const waiting = (progress?.drafted ?? 0) + (progress?.queued ?? 0);

      if (
        !window.confirm(
          `Send ${waiting} email${waiting === 1 ? "" : "s"} from your Gmail? ` +
            "They go to real businesses and cannot be unsent.",
        )
      ) {
        return;
      }
    }

    setRunning(action);

    try {
      const res = await fetch(`/api/hustles/${projectId}/pitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "That did not start");
      }

      toast.success(
        action === "draft"
          ? "Writing them now — they land here as they are written"
          : action === "send"
            ? "Sending, slowly and on purpose"
            : "Checked for replies",
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Something went wrong");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* ---- the message column ---- */}
      <div className="border-border/60 flex w-full max-w-[22rem] shrink-0 flex-col border-r md:w-[22rem]">
        <div className="border-border/60 flex flex-col gap-3.5 border-b p-4">
          <div className="flex items-center justify-between">
            <h1 className="font-display headline-display text-base tracking-[-0.02em]">
              Pitching
            </h1>
            <Label className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Unread</span>
              <Switch
                checked={unreadOnly}
                onCheckedChange={setUnreadOnly}
                className="shadow-none"
              />
            </Label>
          </div>

          {progress && (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <Stat label="drafts" value={progress.drafted} />
              <Stat label="sent" value={progress.sent} />
              <Stat label="replied" value={progress.replied} />
              {progress.unreachable > 0 && (
                <span
                  className="text-muted-foreground/70 text-[11px]"
                  title="Businesses with a site built and no email address anywhere"
                >
                  <span className="font-mono tabular-nums">{progress.unreachable}</span>{" "}
                  no address
                </span>
              )}
            </div>
          )}

          {/* Two tabs, and the second one carries its own count because on a
              real patch it is the bigger number and hiding that would make the
              screen a lie by omission. */}
          <div className="border-border/60 flex gap-4 border-b text-xs">
            {(
              [
                ["pitches", "Pitches", pitches?.length ?? 0],
                ["stuck", "No address", progress?.unreachable ?? 0],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "-mb-px border-b-2 pb-2 transition-colors",
                  tab === key
                    ? "border-foreground text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {label}{" "}
                <span className="font-mono text-[10px] tabular-nums">{count}</span>
              </button>
            ))}
          </div>

          <div className={cn("relative", tab === "stuck" && "hidden")}>
            <MagnifyingGlassIcon className="text-muted-foreground/60 absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search businesses"
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => void run("draft")}
              disabled={running !== null}
            >
              <EnvelopeSimpleIcon className="size-3.5" />
              Write
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => void run("send")}
              disabled={running !== null || (progress?.drafted ?? 0) === 0}
            >
              <PaperPlaneTiltIcon className="size-3.5" />
              Send {progress?.drafted ? progress.drafted : ""}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => void run("replies")}
              disabled={running !== null || (progress?.sent ?? 0) === 0}
            >
              Replies
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "stuck" ? (
            <NoAddressList projectId={projectId} />
          ) : pitches === undefined ? (
            <div className="space-y-px p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-muted/50 h-16 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm text-balance">
              {(pitches?.length ?? 0) === 0
                ? "No pitches yet. Press Write and one gets drafted for every business you have built a site for."
                : "Nothing matches that."}
            </p>
          ) : (
            shown.map((pitch) => (
              <Row
                key={pitch._id}
                pitch={pitch}
                active={open?._id === pitch._id}
                onPick={() => {
                  setPicked(pitch._id);
                  if (!pitch.readAt) void markRead({ pitchId: pitch._id });
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ---- the reading pane ---- */}
      <div className="hidden min-w-0 flex-1 md:block">
        {open ? (
          <Reader key={open._id} pitch={open} />
        ) : (
          <div className="text-muted-foreground flex h-full items-center justify-center p-10 text-center text-sm text-balance">
            Pick a business to read what was written to them.
          </div>
        )}
      </div>
    </div>
  );
};
