"use client";

import { toast } from "sonner";
import { useState } from "react";
import { Check, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Stripe } from "@/components/ui/svgs/stripe";

import { ConnectionCard } from "./connection-card";
import type { StripeStatus } from "../server/stripe-status";

const COPY: Record<StripeStatus, string> = {
  unconfigured: "Invoice clients and get paid straight to your bank.",
  none: "Invoice clients and get paid straight to your bank. We take 30% of what you charge.",
  pending: "Stripe still needs a few details before you can be paid.",
  ready: "Invoices go out through Stripe. Payouts land in your bank.",
};

interface Props {
  status: StripeStatus;
};

export const StripeConnection = ({ status }: Props) => {
  const [starting, setStarting] = useState(false);

  const onConnect = async () => {
    setStarting(true);

    try {
      const res = await fetch("/api/stripe/connect", { method: "POST" });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not start Stripe onboarding");
      }

      const { url } = await res.json();

      // Account Links are single-use and short-lived, so hand off straight
      // away rather than storing the URL.
      window.location.href = url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start Stripe"
      );
      setStarting(false);
    }
  };

  const action =
    status === "ready" ? (
      <span className="text-primary inline-flex items-center gap-1.5 text-sm font-medium">
        <Check className="size-4" /> Connected
      </span>
    ) : status === "unconfigured" ? (
      <span className="text-muted-foreground text-sm">Soon</span>
    ) : (
      <Button
        onClick={onConnect}
        disabled={starting}
        variant={status === "pending" ? "outline" : "default"}
        className="h-10 rounded-lg px-4 text-sm font-medium tracking-tight"
      >
        {starting ? (
          <>
            <Loader2Icon className="size-4 animate-spin" /> Opening
          </>
        ) : status === "pending" ? (
          "Finish setup"
        ) : (
          "Connect"
        )}
      </Button>
    );

  return (
    <ConnectionCard
      muted={status === "unconfigured"}
      logo={<Stripe className="size-6" />}
      name="Stripe"
      description={COPY[status]}
      action={action}
    />
  );
};
