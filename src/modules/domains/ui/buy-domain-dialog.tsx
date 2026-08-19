"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRightIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Buying a business its own address.
 *
 * The site is already live when this opens — on our domain, at a subdomain
 * nobody would read out loud. That is the thing this replaces, and it is why
 * the current address sits at the top of the dialog rather than being hidden:
 * the offer only makes sense next to what they have now.
 *
 * One search box and a short list of prices. No cart, no configuration, no
 * privacy add-on — the whole transaction is one name and one number, and every
 * extra field here is a place a freelancer stops halfway through while a
 * client is on the phone.
 */

interface Offer {
  domain: string;
  available: boolean;
  price?: string;
  priceCents?: number;
  why?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  /** The business, used to seed the search. */
  name: string;
  /** Where the site lives today — our subdomain. */
  currentUrl?: string;
}

/** Debounce, so a search does not fire a registrar lookup per keystroke. */
const TYPING_MS = 500;

export const BuyDomainDialog = ({
  open,
  onOpenChange,
  leadId,
  name,
  currentUrl,
}: Props) => {
  const [term, setTerm] = useState(name);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  // Reset every time it opens. A dialog that reopens showing the last search
  // is showing prices that may be minutes old on names that may be gone.
  useEffect(() => {
    if (open) {
      setTerm(name);
      setOffers(null);
      setBuying(null);
    }
  }, [open, name]);

  useEffect(() => {
    if (!open) return;

    const query = term.trim();

    if (query.length < 2) {
      setOffers(null);
      return;
    }

    // Aborted on the way out, so a slow answer for an old query cannot land
    // after a fast one for the current query and overwrite it.
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setSearching(true);

      try {
        const response = await fetch("/api/domains/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: query }),
          signal: controller.signal,
        });

        const body = await response.json();

        if (!response.ok) throw new Error(body?.error ?? "Could not search.");

        setOffers(body.offers ?? []);
      } catch (cause) {
        if (controller.signal.aborted) return;

        setOffers([]);
        toast.error(cause instanceof Error ? cause.message : "Could not search domains");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, TYPING_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, term]);

  const onBuy = async (domain: string) => {
    setBuying(domain);

    try {
      const response = await fetch("/api/domains/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, domain }),
      });

      const body = await response.json();

      if (!response.ok || !body?.url) {
        throw new Error(body?.error ?? "Could not start the payment.");
      }

      // Straight to Stripe. Nothing is cleared on the way out — the page is
      // leaving, and a dialog that tidies itself up first just flickers.
      window.location.href = body.url;
    } catch (cause) {
      setBuying(null);
      toast.error(cause instanceof Error ? cause.message : "Could not start the payment");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Give {name} its own domain</DialogTitle>
          <DialogDescription>
            {currentUrl ? (
              <>
                The site is live at{" "}
                <span className="font-mono text-[11px]">
                  {currentUrl.replace(/^https:\/\//, "")}
                </span>
                . A domain of their own replaces it, and the old link keeps
                working.
              </>
            ) : (
              "Bought, connected and secured in about a minute. Renews yearly."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <MagnifyingGlassIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            autoFocus
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="joes gym"
            aria-label="Search for a domain"
            className="pl-9"
          />
        </div>

        <div className="min-h-[13rem]">
          {searching && offers === null ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
              <Spinner className="size-4" />
              Checking what is free
            </div>
          ) : offers === null ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              Type a name to see what is available.
            </p>
          ) : offers.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              Nothing came back for that. Try a shorter name.
            </p>
          ) : (
            <ul className={cn("divide-border/70 divide-y", searching && "opacity-60")}>
              {offers.map((offer) => (
                <li
                  key={offer.domain}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13px]">{offer.domain}</p>
                    {!offer.available && offer.why && (
                      <p className="text-muted-foreground truncate text-[11px]">
                        {offer.why}
                      </p>
                    )}
                  </div>

                  {offer.available ? (
                    <Button
                      size="sm"
                      disabled={buying !== null}
                      onClick={() => onBuy(offer.domain)}
                      className="shrink-0 tabular-nums"
                    >
                      {buying === offer.domain ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <>
                          {offer.price}
                          <ArrowUpRightIcon className="size-3.5 opacity-70" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                      taken
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Said before they pay, not after. The yearly part is the only
            surprise this purchase can hold, and a price that turns out to
            repeat is the kind of surprise people remember.

            Worded as where to look rather than as a promise to tell them.
            Nothing in this product sends email to its own users, and a line
            saying otherwise would be a promise the code does not keep. */}
        <p className="text-muted-foreground flex items-start gap-2 text-[11px]">
          <CheckCircleIcon className="mt-px size-3.5 shrink-0" />
          One year, connected automatically. Renewal dates are on your Domains
          page.
        </p>
      </DialogContent>
    </Dialog>
  );
};
