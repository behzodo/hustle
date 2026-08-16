"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import {
  BugIcon,
  HeartIcon,
  LightbulbIcon,
  ChatCircleIcon,
  type Icon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";

type Kind = "idea" | "bug" | "praise" | "other";

const KINDS: { value: Kind; label: string; icon: Icon }[] = [
  { value: "idea", label: "An idea", icon: LightbulbIcon },
  { value: "bug", label: "Something broke", icon: BugIcon },
  { value: "praise", label: "Praise", icon: HeartIcon },
  { value: "other", label: "Other", icon: ChatCircleIcon },
];

export const FeedbackView = () => {
  const { user } = useUser();
  const submit = useMutation(api.feedback.submit);

  const [kind, setKind] = useState<Kind>("idea");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await submit({
        kind,
        message,
        email: user?.primaryEmailAddress?.emailAddress,
      });
      setSent(true);
      setMessage("");
      toast.success("Sent — thank you");
    } catch {
      toast.error("Could not send that. Try again in a moment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-4 md:p-6">
      <div>
        <p className="eyebrow text-muted-foreground/70 font-medium">Feedback</p>
        <h1 className="headline-display font-display mt-2 text-3xl leading-[1.02] tracking-[-0.03em] text-balance md:text-4xl">
          Tell us what is{" "}
          <span className="headline-figure text-primary italic">missing</span>.
        </h1>
        <p className="deck font-display text-muted-foreground mt-2 text-balance">
          Read by a person, not routed to a queue. Say what you were trying to
          do and what happened instead.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white dark:bg-sidebar flex flex-col gap-5 rounded-2xl border p-5"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KINDS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setKind(value)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-3 text-left text-sm transition-colors",
                kind === value
                  ? "border-primary bg-muted/60 font-medium"
                  : "hover:bg-muted/40",
              )}
            >
              <Icon
                className="size-4"
                weight={kind === value ? "fill" : "light"}
              />
              {label}
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={6}
          maxLength={4000}
          placeholder="I was trying to…"
          className="placeholder:text-muted-foreground focus-visible:ring-ring w-full resize-none rounded-xl border p-3 text-sm outline-none focus-visible:ring-2"
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            {sent
              ? "Sent. Send another any time."
              : user?.primaryEmailAddress?.emailAddress
                ? `We will reply to ${user.primaryEmailAddress.emailAddress}`
                : "Sent with your account so we can reply."}
          </p>
          <Button
            type="submit"
            disabled={!message.trim() || sending}
            className="h-10 rounded-xl px-5 text-sm font-medium tracking-tight"
          >
            {sending ? "Sending…" : "Send feedback"}
          </Button>
        </div>
      </form>
    </div>
  );
};
