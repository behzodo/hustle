"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Telling somebody how the purchase went, once they are back.
 *
 * The buy flow leaves the app for Stripe and returns through a route handler,
 * so there is no component left alive to hold the result — it has to travel in
 * the URL. This reads it, says it, and takes it back out of the address bar so
 * a refresh does not announce a purchase for a second time.
 *
 * The wording is split by outcome rather than by success. "Paid and refunded"
 * and "paid and stuck" are both failures and they need opposite things from
 * the person reading them: one is over, the other is money they are still
 * owed.
 */

const MESSAGES: Record<string, { text: (name: string) => string; kind: "ok" | "bad" | "info" }> = {
  live: {
    kind: "ok",
    text: (name) =>
      name
        ? `${name} is live. The certificate finishes issuing in a minute or two.`
        : "The domain is live.",
  },
  working: {
    kind: "info",
    text: () => "That purchase is already going through.",
  },
  unpaid: {
    kind: "bad",
    text: () => "The payment did not go through, so nothing was bought.",
  },
  refunded: {
    kind: "bad",
    text: () => "The domain could not be registered, so the payment was refunded.",
  },
  failed: {
    kind: "bad",
    text: () =>
      "The domain could not be registered and the refund did not go through either. We are on it.",
  },
  mismatch: {
    kind: "bad",
    text: () => "That payment does not belong to that order.",
  },
  missing: {
    kind: "bad",
    text: () => "That order could not be found.",
  },
  unconfigured: {
    kind: "bad",
    text: () => "The domain shop is not set up on this environment.",
  },
};

export const DomainReturnToast = () => {
  const params = useSearchParams();
  const router = useRouter();

  // A ref rather than state: React runs effects twice in development, and a
  // purchase announced twice reads as two purchases.
  const said = useRef<string | null>(null);

  const outcome = params.get("domain");
  const name = params.get("name") ?? "";
  const why = params.get("why") ?? "";

  useEffect(() => {
    if (!outcome || said.current === outcome + name) return;

    said.current = outcome + name;

    const message = MESSAGES[outcome];

    if (message) {
      const text = message.text(name);
      const options = why ? { description: why } : undefined;

      if (message.kind === "ok") toast.success(text, options);
      else if (message.kind === "bad") toast.error(text, options);
      else toast(text, options);
    }

    // Cleared so a refresh is a refresh. `replace` rather than `push` for the
    // same reason — the result is not a place worth having in history.
    const next = new URLSearchParams(params.toString());
    next.delete("domain");
    next.delete("name");
    next.delete("why");

    const query = next.toString();
    router.replace(query ? `?${query}` : window.location.pathname, { scroll: false });
  }, [outcome, name, why, params, router]);

  return null;
};
