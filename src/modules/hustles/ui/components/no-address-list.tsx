"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowSquareOutIcon, PhoneIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProjectId } from "@/modules/projects/types";
import { useSetLeadEmail, useUnreachable } from "@/modules/hustles/use-pitches";

/**
 * The businesses with a website and nobody to send it to.
 *
 * This list is the honest half of the pitch screen, and on real data it is the
 * longer half by a distance: of seventy-three businesses swept in Jacksonville
 * and built sites for, seventy had no email address published anywhere. That
 * is not a bug in the finder. A Google Maps listing has no email field, and a
 * business with no website generally has no other page for one to sit on.
 *
 * So this is a worklist rather than a report. Every row carries the two things
 * that still work — a phone number, and a box to type an address into — and
 * the moment one is typed, the pitch for that business can be written.
 *
 * Sorted best-score first, because nobody is going to do seventy of these by
 * hand and the top ten are where the money is.
 */

const Row = ({
  lead,
}: {
  lead: NonNullable<ReturnType<typeof useUnreachable>>[number];
}) => {
  const setEmail = useSetLeadEmail();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!value.trim()) return;

    setSaving(true);

    try {
      await setEmail({ leadId: lead._id, email: value });
      // Not cleared on purpose — the row leaves this list the moment the
      // mutation lands, and clearing it first makes the field flash empty on
      // the way out.
      toast.success(`${lead.name} — saved. Press Write to draft their pitch.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "That did not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-border/60 flex flex-col gap-2 border-b p-4 last:border-b-0">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{lead.name}</span>
        <span className="text-muted-foreground/60 shrink-0 font-mono text-[10px] tabular-nums">
          {lead.score}
        </span>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="truncate">{lead.trade}</span>

        {lead.phone && (
          // A tel: link rather than plain text. On a laptop it opens whatever
          // handles calls and on a phone it dials — and for seventy of these
          // businesses the phone is the only channel there is.
          <a
            href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}
            className="hover:text-foreground flex items-center gap-1 font-mono"
          >
            <PhoneIcon className="size-3" />
            {lead.phone}
          </a>
        )}

        <a
          href={lead.siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground flex items-center gap-1"
        >
          <ArrowSquareOutIcon className="size-3" />
          their site
        </a>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="flex gap-1.5"
      >
        <Input
          type="email"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="their email, if you find one"
          className="h-7 text-xs"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 text-xs"
          disabled={saving || !value.trim()}
        >
          Save
        </Button>
      </form>
    </div>
  );
};

export const NoAddressList = ({
  projectId,
  className,
}: {
  projectId: ProjectId;
  className?: string;
}) => {
  const leads = useUnreachable(projectId);

  if (leads === undefined) {
    return (
      <div className={cn("space-y-px p-4", className)}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted/50 h-24 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <p className={cn("text-muted-foreground p-6 text-sm text-balance", className)}>
        Every business with a site has an address to send it to.
      </p>
    );
  }

  return (
    <div className={className}>
      <p className="text-muted-foreground border-border/60 border-b p-4 text-xs text-balance">
        A site built and nowhere to send it. Google listings carry a phone
        number and never an email, so these need one typed in — or a call.
      </p>

      {leads.map((lead) => (
        <Row key={lead._id} lead={lead} />
      ))}
    </div>
  );
};
