"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowSquareOutIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  FacebookLogoIcon,
  InstagramLogoIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  ProhibitIcon,
  ReceiptIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ProjectId } from "@/modules/projects/types";
import {
  useEditPitch,
  useMarkPitchRead,
  usePitchProgress,
  usePitches,
  useSetPitchStatus,
} from "@/modules/hustles/use-pitches";

import { NoAddressList } from "./no-address-list";

/**
 * The inbox.
 *
 * Bones from shadcn's sidebar-09 — rail, message column, reading pane —
 * because that shape is what everybody already knows how to use, and this
 * screen asks somebody to read hundreds of emails they did not write.
 *
 * Dressed in the same milled metal as the rest of the product, and dressed
 * deliberately rather than decoratively: this is the panel where a machine
 * that built seventy-three websites hands over to a person who has to decide
 * which of them to send. So it is built like an instrument. Engraved labels,
 * hairline rules, one gauge, and exactly one plate of chrome — on Send, which
 * is the only control here that cannot be undone.
 *
 * Colour is spent nowhere. The app is chroma 0 throughout and a status pill in
 * amber would be the loudest thing on the screen while saying the least; state
 * is carried by an engraved capsule and a 4px dot instead. Two things are
 * different from a mail client: the reading pane shows the website beside the
 * email, because judging a pitch means looking at the page it links to; and
 * nothing sends by itself.
 */

/** How a pitch reads, by where it has got to. */
const LOOKS: Record<string, { label: string; dot: string }> = {
  drafted: { label: "Draft", dot: "bg-foreground/45" },
  queued: { label: "Queued", dot: "bg-foreground/70" },
  sending: { label: "Sending", dot: "bg-foreground/70 animate-pulse" },
  sent: { label: "Sent", dot: "bg-foreground" },
  // The two that mean a person wrote back get the one ring of emphasis on the
  // screen, because on a list of four hundred that is the only event worth
  // finding at a glance.
  replied: { label: "Replied", dot: "bg-foreground ring-foreground/25 ring-3" },
  won: { label: "Won", dot: "bg-foreground ring-foreground/40 ring-3" },
  lost: { label: "Lost", dot: "bg-foreground/20" },
  failed: { label: "Blocked", dot: "bg-foreground/25 ring-foreground/20 ring-2" },
};

const look = (status: string) => LOOKS[status] ?? LOOKS.sent;

/**
 * Which way this one went.
 *
 * Worth a glyph on every row rather than a column, because the channel
 * explains the message: a hundred and ten words with a sign-off is an email,
 * two sentences is a text, and a reader who cannot tell them apart will judge
 * the text for being short.
 */
const CHANNELS = {
  email: { Icon: EnvelopeSimpleIcon, label: "Email" },
  sms: { Icon: ChatCircleDotsIcon, label: "Text" },
  instagram: { Icon: InstagramLogoIcon, label: "Instagram" },
  facebook: { Icon: FacebookLogoIcon, label: "Facebook" },
} as const;

const channelOf = (channel: string) =>
  CHANNELS[channel as keyof typeof CHANNELS] ?? CHANNELS.email;

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

/** An etched capsule. Says the state without shouting a colour at it. */
const Stamp = ({ status }: { status: string }) => {
  const style = look(status);

  return (
    <span className="border-border/70 bg-muted/40 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-[3px]">
      <span className={cn("size-1 rounded-full", style.dot)} />
      <span className="engraved text-muted-foreground text-[9px] leading-none tracking-[0.18em] uppercase">
        {style.label}
      </span>
    </span>
  );
};

/* -------------------------------------------------------------------------- *
 * The gauge.
 * -------------------------------------------------------------------------- */

/**
 * Every site this hustle built, and what happened to it.
 *
 * The signature of the screen, and the only place its hardest fact is stated
 * plainly: on a real patch most of the bar cannot be filled. Sixty-one of
 * seventy-three Jacksonville businesses had no web page at all, so there was
 * nowhere to find an email — and that segment is machined rather than left
 * empty, because an empty channel reads as work outstanding and this is a
 * stop.
 *
 * Four numbers in a row would carry the same data and none of the meaning.
 */
const Gauge = ({
  progress,
}: {
  progress: NonNullable<ReturnType<typeof usePitchProgress>>;
}) => {
  const total = Math.max(progress.live, 1);
  const inPlay = progress.drafted + progress.queued + progress.sent + progress.replied;
  const pct = (n: number) => `${Math.round((n / total) * 1000) / 10}%`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="engraved text-muted-foreground/70 text-[9px] tracking-[0.28em] uppercase">
          This patch
        </span>
        <span className="text-muted-foreground/60 font-mono text-[10px] tabular-nums">
          {progress.live} sites
        </span>
      </div>

      <div
        className="gauge relative flex h-[7px] w-full overflow-hidden"
        role="img"
        aria-label={`${inPlay} of ${progress.live} sites have a pitch, ${progress.unreachable} have no address`}
      >
        <span className="gauge-fill h-full" style={{ width: pct(inPlay) }} />
        {/* Butted straight against the fill, no gap: it is the same channel,
            and a gap would read as a third state. */}
        <span className="gauge-knurl h-full" style={{ width: pct(progress.unreachable) }} />
      </div>

      <p className="text-muted-foreground/70 font-mono text-[10px] tabular-nums">
        {progress.drafted} written · {progress.sent} sent · {progress.replied} replied
        {progress.unreachable > 0 && (
          <> · <span className="text-muted-foreground">{progress.unreachable} no address</span></>
        )}
      </p>
    </div>
  );
};

/* -------------------------------------------------------------------------- *
 * The list.
 * -------------------------------------------------------------------------- */

/** The channel glyph. Muted — it labels the row, it does not compete with it. */
const Channel = ({ channel }: { channel: string }) => {
  const { Icon, label } = channelOf(channel);

  return (
    <Icon
      className="text-muted-foreground/50 size-3 shrink-0"
      weight="fill"
      aria-label={label}
    />
  );
};

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
  const answer = pitch.thread.at(-1)?.side === "them" ? pitch.thread.at(-1) : null;

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "border-border/50 hover:bg-muted/40 relative flex w-full flex-col items-start gap-1.5 border-b py-3.5 pr-4 pl-4 text-left text-sm leading-tight transition-colors last:border-b-0",
        // The lit rail rather than a fill: the list is monochrome and dense,
        // so which row you are reading has to be a change of material.
        active && "milled bg-muted/50 rail-lit",
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span className={cn("size-1 shrink-0 rounded-full", style.dot)} />
        <Channel channel={pitch.channel} />
        <span
          className={cn(
            "min-w-0 flex-1 truncate tracking-[-0.01em]",
            unread ? "text-foreground font-medium" : "text-muted-foreground",
          )}
        >
          {pitch.business}
        </span>
        <span className="text-muted-foreground/50 shrink-0 font-mono text-[10px] tabular-nums">
          {when(pitch.updatedAt)}
        </span>
      </div>

      <span
        className={cn(
          "w-full truncate text-[13px]",
          unread ? "text-foreground/90 font-medium" : "text-muted-foreground/80",
        )}
      >
        {pitch.subject}
      </span>

      <span className="text-muted-foreground/60 line-clamp-2 w-full text-xs">
        {/* Their reply once there is one — it is what changed, and a row still
            teasing our own email hides the only new thing on the screen. */}
        {answer ? (
          <>
            <span className="engraved text-muted-foreground mr-1.5 text-[9px] tracking-[0.18em] uppercase">
              Reply
            </span>
            {answer.text.slice(0, 150)}
          </>
        ) : (
          teaser(pitch.body)
        )}
      </span>
    </button>
  );
};

/* -------------------------------------------------------------------------- *
 * The reading pane.
 * -------------------------------------------------------------------------- */

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline gap-3 text-xs">
    <span className="engraved text-muted-foreground/60 w-9 shrink-0 text-[9px] tracking-[0.2em] uppercase">
      {label}
    </span>
    <span className="text-foreground/80 min-w-0 truncate font-mono text-[11px]">
      {value}
    </span>
  </div>
);

/**
 * The invoice, or the button that makes one.
 *
 * The last thing that happens in this product and the only one that moves
 * money, so it gets the one plate of chrome in the reading pane — the same
 * material as Send in the column, and for the same reason: both put something
 * beyond reach.
 *
 * The figure is editable before it goes. A price band is a range and an
 * invoice is a number, and the person who agreed the job knows which number
 * they agreed better than the profile does.
 */
const Invoice = ({ pitch }: { pitch: Pitch }) => {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const raise = async () => {
    if (
      !window.confirm(
        `Raise an invoice to ${pitch.business}? It is finalised at Stripe the moment you do.`,
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const res = await fetch(`/api/pitch/${pitch._id}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(amount ? { amount: Number(amount) } : {}),
      });
      const body = await res.json();

      if (!res.ok) throw new Error(body.error ?? "Stripe refused it");

      toast.success(
        body.emailed
          ? `Invoice for ${body.shown} sent to ${pitch.to}`
          : `Invoice for ${body.shown} raised — the link is on the card`,
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "That did not work");
    } finally {
      setBusy(false);
    }
  };

  if (pitch.invoice) {
    const shown = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: pitch.invoice.currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(pitch.invoice.amount / 100);

    return (
      <div className="border-border/60 milled mt-8 max-w-[58ch] rounded-lg border p-4">
        <p className="engraved text-muted-foreground/70 text-[9px] tracking-[0.28em] uppercase">
          Invoice {pitch.invoice.number ?? ""}
        </p>

        <p className="font-display headline-display mt-2 text-2xl tracking-[-0.02em] tabular-nums">
          {shown}
        </p>

        <p className="text-muted-foreground/70 mt-1 font-mono text-[10px]">
          {pitch.invoice.paidAt ? "Paid" : "Awaiting payment"} · your share{" "}
          {new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: pitch.invoice.currency.toUpperCase(),
            maximumFractionDigits: 0,
          }).format((pitch.invoice.amount - pitch.invoice.fee) / 100)}
        </p>

        <Button size="sm" variant="outline" className="mt-3 h-7 text-xs" asChild>
          <a href={pitch.invoice.url} target="_blank" rel="noopener noreferrer">
            <ArrowSquareOutIcon className="size-3.5" />
            Open the payment page
          </a>
        </Button>
      </div>
    );
  }

  // Only once there is a conversation. An invoice raised against a business
  // that has not answered is a bill sent to a stranger.
  if (pitch.status !== "replied" && pitch.status !== "sent" && pitch.status !== "won") {
    return null;
  }

  return (
    <div className="border-border/60 mt-8 flex max-w-[58ch] flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
      <ReceiptIcon className="text-muted-foreground/60 size-4 shrink-0" />
      <span className="text-muted-foreground text-xs">Agreed a price?</span>

      <div className="relative">
        <span className="text-muted-foreground/60 absolute top-1/2 left-2 -translate-y-1/2 text-xs">
          $
        </span>
        <Input
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
          placeholder="900"
          className="h-7 w-24 pl-5 text-xs"
          inputMode="decimal"
        />
      </div>

      <Button
        size="sm"
        className="metal-plate h-7 border-0 bg-transparent text-xs shadow-none dark:bg-transparent"
        onClick={() => void raise()}
        disabled={busy}
      >
        Raise the invoice
      </Button>
    </div>
  );
};

const Reader = ({ pitch }: { pitch: Pitch }) => {
  const edit = useEditPitch();
  const setStatus = useSetPitchStatus();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ subject: pitch.subject, body: pitch.body });
  const [saving, setSaving] = useState(false);

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
      <header className="border-border/60 milled flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* The one piece of display type on the screen, and the one thing
                cut from chrome. It is the name of a real shop in a real town,
                which is the whole reason any of this exists. */}
            <h2 className="metal-text font-display headline-display max-w-full truncate text-[26px] leading-none tracking-[-0.03em]">
              {pitch.business}
            </h2>
            <Stamp status={pitch.status} />
          </div>

          <p className="text-muted-foreground/70 mt-1.5 flex items-center gap-1.5 text-xs">
            <Channel channel={pitch.channel} />
            {channelOf(pitch.channel).label} · {pitch.trade}
          </p>

          <div className="mt-4 space-y-1.5">
            <Field label={pitch.channel === "sms" ? "Number" : "To"} value={pitch.to} />
            <Field label="Site" value={pitch.siteUrl.replace("https://", "")} />
            {pitch.sentAt && <Field label="Sent" value={when(pitch.sentAt)} />}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {editable && (
            <Button
              size="sm"
              variant={editing ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => (editing ? void save() : setEditing(true))}
              disabled={saving}
            >
              <PencilSimpleIcon className="size-3.5" />
              {editing ? "Save" : "Edit"}
            </Button>
          )}

          {(pitch.status === "sent" || pitch.status === "replied") && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => void mark("won")}
              >
                <CheckCircleIcon className="size-3.5" />
                Won
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => void mark("lost")}
              >
                <ProhibitIcon className="size-3.5" />
                Lost
              </Button>
            </>
          )}

          <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
            <a href={pitch.siteUrl} target="_blank" rel="noopener noreferrer">
              <ArrowSquareOutIcon className="size-3.5" />
              Open
            </a>
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 px-6 py-6">
          {pitch.error && (
            <div className="border-border/70 bg-muted/40 text-muted-foreground mb-5 flex gap-2.5 rounded-lg border p-3 text-xs">
              <WarningCircleIcon className="text-foreground/60 mt-px size-4 shrink-0" />
              <span>{pitch.error}</span>
            </div>
          )}

          {reply && (
            // Above our own email. It is why the row moved to the top of the
            // list, and putting it under a hundred and ten words somebody
            // already wrote is putting it where nobody looks.
            <div className="border-border/60 milled bg-muted/40 mb-6 rounded-lg border p-4">
              <p className="engraved text-muted-foreground/70 mb-2 text-[9px] tracking-[0.28em] uppercase">
                They wrote back · {when(reply.at)}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{reply.text}</p>
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
                Your address, your name on it. Nothing checks this again after you
                save.
              </p>
            </div>
          ) : (
            <article className="max-w-[58ch]">
              <p className="engraved text-muted-foreground/60 text-[9px] tracking-[0.28em] uppercase">
                Subject
              </p>
              <p className="mt-1.5 mb-5 text-[15px] font-medium tracking-[-0.01em]">
                {pitch.subject}
              </p>
              <p className="text-foreground/85 text-sm leading-[1.75] whitespace-pre-wrap">
                {pitch.body}
              </p>
            </article>
          )}

          {/* What the checker caught, kept rather than thrown away: a check
              that fired and was overruled is still the only record it fired. */}
          {pitch.write && pitch.write.problems.length > 0 && (
            <details className="border-border/60 mt-8 max-w-[58ch] rounded-lg border p-3">
              <summary className="engraved text-muted-foreground cursor-pointer text-[9px] tracking-[0.2em] uppercase">
                The checker had {pitch.write.problems.length} note
                {pitch.write.problems.length === 1 ? "" : "s"}
              </summary>
              <ul className="text-muted-foreground mt-2.5 space-y-1 text-xs">
                {pitch.write.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            </details>
          )}

          <Invoice pitch={pitch} />

          {pitch.write && (
            <p className="text-muted-foreground/50 mt-5 font-mono text-[10px]">
              {pitch.write.provider} · {pitch.write.tokens} tokens ·{" "}
              {pitch.write.seconds}s
              {pitch.write.rewrites > 0 && ` · rewritten ${pitch.write.rewrites}×`}
            </p>
          )}
        </div>

        {/* The page itself, behind a chrome rim — the same bezel the product
            uses elsewhere for something you look through rather than at.
            Sandboxed and inert: this is a look, not a visit. */}
        <aside className="border-border/60 hidden min-w-0 border-l px-5 py-6 lg:block">
          <p className="engraved text-muted-foreground/60 mb-3 text-[9px] tracking-[0.28em] uppercase">
            What they will see
          </p>

          <div
            className="metal-bezel w-full"
            style={
              { "--bezel-radius": "0.85rem", "--bezel-rim": "3px" } as React.CSSProperties
            }
          >
            <div className="bg-background relative aspect-[3/4] overflow-hidden rounded-[0.6rem]">
              <iframe
                src={pitch.siteUrl}
                title={pitch.business}
                loading="lazy"
                tabIndex={-1}
                sandbox=""
                className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
                style={{ width: 1280, height: 1780, transform: "scale(0.213)" }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- *
 * The screen.
 * -------------------------------------------------------------------------- */

export const PitchInbox = ({ projectId }: { projectId: ProjectId }) => {
  const pitches = usePitches(projectId);
  const progress = usePitchProgress(projectId);
  const markRead = useMarkPitchRead();

  const [picked, setPicked] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  // Which of the two lists the column shows. A tab rather than a second
  // screen, because they are two halves of one question — who has been written
  // to, and who cannot be — and on a real patch the second is most of it.
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
    // Sending is the one thing here that cannot be undone, so it is the one
    // thing that asks. Everything else writes to our own database.
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

  const tabs = [
    ["pitches", "Pitches", pitches?.length ?? 0],
    ["stuck", "No address", progress?.unreachable ?? 0],
  ] as const;

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* ---- the message column ---- */}
      <div className="border-border/60 flex w-full max-w-[23rem] shrink-0 flex-col border-r md:w-[23rem]">
        <div className="border-border/60 milled flex flex-col gap-4 border-b px-4 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="engraved text-foreground/80 text-[10px] tracking-[0.32em] uppercase">
              Pitching
            </h1>
            <Label className="flex items-center gap-2">
              <span className="engraved text-muted-foreground/70 text-[9px] tracking-[0.2em] uppercase">
                Unread
              </span>
              <Switch
                checked={unreadOnly}
                onCheckedChange={setUnreadOnly}
                className="shadow-none"
              />
            </Label>
          </div>

          {progress && <Gauge progress={progress} />}

          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 text-[11px]"
              onClick={() => void run("draft")}
              disabled={running !== null}
            >
              Write
            </Button>
            {/* The one plate of chrome on the screen, on the one control that
                puts something beyond reach. */}
            <Button
              size="sm"
              className="metal-plate h-7 flex-1 border-0 bg-transparent text-[11px] shadow-none dark:bg-transparent"
              onClick={() => void run("send")}
              disabled={running !== null || (progress?.drafted ?? 0) === 0}
            >
              <PaperPlaneTiltIcon className="size-3.5" weight="fill" />
              Send{progress?.drafted ? ` ${progress.drafted}` : ""}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={() => void run("replies")}
              disabled={running !== null || (progress?.sent ?? 0) === 0}
            >
              Replies
            </Button>
          </div>
        </div>

        <div className="border-border/60 flex items-stretch gap-5 border-b px-4">
          {tabs.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "engraved relative py-2.5 text-[9px] tracking-[0.2em] uppercase transition-colors",
                tab === key
                  ? "text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground",
              )}
            >
              {label}{" "}
              <span className="font-mono text-[10px] tracking-normal tabular-nums">
                {count}
              </span>
              {tab === key && (
                <span className="gauge-fill absolute inset-x-0 -bottom-px h-[2px] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {tab === "pitches" && (
          <div className="border-border/60 relative border-b px-4 py-2.5">
            <MagnifyingGlassIcon className="text-muted-foreground/50 absolute top-1/2 left-6.5 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search this patch"
              className="h-7 border-0 bg-transparent pl-6 text-xs shadow-none focus-visible:ring-0"
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "stuck" ? (
            <NoAddressList projectId={projectId} />
          ) : pitches === undefined ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-muted/50 h-16 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="text-muted-foreground px-5 py-8 text-sm text-balance">
              {(pitches?.length ?? 0) === 0
                ? "Nothing written yet. Press Write and one email gets drafted for every business you have built a site for."
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
          <div className="flex h-full items-center justify-center p-10">
            <p className="text-muted-foreground/70 max-w-xs text-center text-sm text-balance">
              Pick a business to read what was written to them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
