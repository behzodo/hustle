"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useConvexAuth, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowSquareOutIcon,
  GlobeIcon,
  WarningIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { api } from "@/../convex/_generated/api";
import { money } from "@/domains/price";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Every domain sold, and the two things that go wrong with them.
 *
 * A list rather than a dashboard, because there is very little to know about a
 * domain that is working: it exists, it points somewhere, and it runs out on a
 * date. What the screen is really for is the small number that are not working,
 * so those are lifted to the top rather than sorted in with the rest.
 *
 * The first kind is an order that was paid for and never registered — the tab
 * closed mid-purchase. Nothing retries that on its own, which is exactly why it
 * needs a row with a button on it.
 *
 * The second is a renewal coming up. The domain itself is safe; what is at risk
 * is the year of it nobody has invoiced the client for yet.
 */

/** Inside this, a renewal is worth saying something about. */
const SOON_MS = 30 * 24 * 60 * 60 * 1000;

interface DomainRow {
  _id: string;
  domain: string;
  status: "pending" | "paid" | "live" | "failed" | "refunded";
  priceCents: number;
  costCents?: number;
  sslStatus?: string;
  error?: string;
  registeredAt?: number;
  renewsAt?: number;
  updatedAt: number;
}

/** What the row says about itself, in one word and one colour. */
const STATE: Record<
  DomainRow["status"],
  { label: string; tone: string }
> = {
  live: { label: "live", tone: "bg-foreground/8 text-foreground" },
  paid: { label: "unfinished", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  pending: { label: "not paid", tone: "text-muted-foreground bg-foreground/5" },
  failed: { label: "failed", tone: "bg-destructive/10 text-destructive" },
  refunded: { label: "refunded", tone: "text-muted-foreground bg-foreground/5" },
};

const Pill = ({ status }: { status: DomainRow["status"] }) => {
  const state = STATE[status];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px]",
        state.tone,
      )}
    >
      {state.label}
    </span>
  );
};

const Row = ({ order }: { order: DomainRow }) => {
  const [finishing, setFinishing] = useState(false);

  const soon =
    order.status === "live" &&
    order.renewsAt !== undefined &&
    order.renewsAt - Date.now() < SOON_MS;

  const finish = async () => {
    setFinishing(true);

    try {
      const response = await fetch(`/api/domains/${order._id}/retry`, { method: "POST" });
      const body = await response.json();

      if (!response.ok) throw new Error(body?.error ?? "Could not finish that one.");

      // No state to clear: the row is a live subscription and re-renders as
      // soon as the mutation behind the route lands.
      toast.success(`${order.domain} is live.`);
    } catch (cause) {
      setFinishing(false);
      toast.error(cause instanceof Error ? cause.message : "Could not finish that one");
    }
  };

  return (
    <li className="border-border/60 flex items-center gap-3 border-b py-3 last:border-b-0">
      <GlobeIcon className="text-muted-foreground size-4 shrink-0" weight="light" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-mono text-[13px]">{order.domain}</p>
          <Pill status={order.status} />

          {/* Only while it is still issuing. A certificate that is active is
              the normal state of a working domain and does not need a badge. */}
          {order.status === "live" && order.sslStatus && order.sslStatus !== "active" && (
            <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
              securing
            </span>
          )}
        </div>

        <p className="text-muted-foreground truncate text-[11px]">
          {order.status === "live" && order.renewsAt ? (
            <>
              Renews {formatDistanceToNow(order.renewsAt, { addSuffix: true })}
              {order.costCents !== undefined && (
                <>
                  {" · "}
                  <span className="tabular-nums">
                    {money(order.priceCents)} in, {money(order.costCents)} out
                  </span>
                </>
              )}
            </>
          ) : order.status === "paid" ? (
            "Paid for, never registered. Finish it or the money sits with nothing bought."
          ) : (
            (order.error ?? `Updated ${formatDistanceToNow(order.updatedAt, { addSuffix: true })}`)
          )}
        </p>
      </div>

      {soon && (
        <span className="hidden shrink-0 items-center gap-1 font-mono text-[10px] text-amber-600 sm:inline-flex dark:text-amber-400">
          <WarningIcon className="size-3.5" weight="fill" />
          invoice the client
        </span>
      )}

      {order.status === "paid" ? (
        <Button size="sm" onClick={finish} disabled={finishing} className="shrink-0">
          {finishing ? <Spinner className="size-3.5" /> : "Finish"}
        </Button>
      ) : order.status === "live" ? (
        <a
          href={`https://${order.domain}`}
          target="_blank"
          rel="noreferrer noopener"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded-sm p-1 outline-none focus-visible:ring-2"
          aria-label={`Open ${order.domain}`}
        >
          <ArrowSquareOutIcon className="size-4" />
        </a>
      ) : null}
    </li>
  );
};

export const DomainsView = () => {
  const { isAuthenticated } = useConvexAuth();
  const domains = useQuery(api.domains.mine, isAuthenticated ? {} : "skip");

  // Unfinished first, then everything else newest first. An order somebody has
  // paid for and not received is the only thing on this screen that is
  // somebody's problem right now.
  const rows = domains
    ? [...(domains as unknown as DomainRow[])].sort((a, b) => {
        const weight = (order: DomainRow) => (order.status === "paid" ? 0 : 1);
        return weight(a) - weight(b) || b.updatedAt - a.updatedAt;
      })
    : undefined;

  return (
    <div className="relative flex w-full flex-col gap-8 p-6 md:p-10">
      <div>
        <h1 className="headline-display font-display text-3xl leading-[1.02] tracking-[-0.03em] text-balance md:text-4xl">
          Domains
        </h1>
        <p className="deck font-display text-muted-foreground mt-2 max-w-lg text-balance">
          Every address bought for a client. Add one from the menu on a
          business&rsquo;s card, once its site is built.
        </p>
      </div>

      {rows === undefined ? (
        <div className="text-muted-foreground flex items-center gap-2 py-16 text-sm">
          <Spinner className="size-4" />
          Loading
        </div>
      ) : rows.length === 0 ? (
        <div className="border-border/70 text-muted-foreground mx-auto max-w-lg rounded-2xl border border-dashed p-10 text-center text-sm text-balance">
          No domains yet. When a client says yes, buy them a real address from
          the card the site was built on.
        </div>
      ) : (
        <ul className="max-w-3xl">
          {rows.map((order) => (
            <Row key={order._id} order={order} />
          ))}
        </ul>
      )}

      {/* Said here rather than in the buy dialog, because it is the thing to
          know about owning one rather than about buying one. Renewal is
          automatic at the registrar and paid out of our balance — what is not
          automatic is charging the client for the year it covers. */}
      {rows !== undefined && rows.length > 0 && (
        <p className="text-muted-foreground max-w-3xl text-[11px]">
          Domains renew automatically. The bill lands on us, so invoice the
          client before the date above.
        </p>
      )}
    </div>
  );
};
