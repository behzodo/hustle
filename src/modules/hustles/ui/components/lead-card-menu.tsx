"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowSquareOutIcon,
  DotsThreeIcon,
  GlobeIcon,
  LinkIcon,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BuyDomainDialog } from "@/modules/domains/ui/buy-domain-dialog";

/**
 * The actions on a business whose site is built.
 *
 * Sits on the corner of the card and only appears once there is a site,
 * because every item under it is about one. A business still in the queue has
 * nothing to open, nothing to copy and nowhere to point a domain.
 *
 * Rendered outside the card's flipping face rather than inside it. The face
 * carries `preserve-3d` and rotates on hover, and a menu button living on it
 * would turn away mid-click; the front is also a single large `<button>`, and
 * a button inside a button is invalid markup that swallows the wrong clicks.
 */

interface Props {
  leadId: string;
  name: string;
  /** Where the site is published — our subdomain. */
  url: string;
  /** The domain they bought for it, once they have. */
  customDomain?: string;
}

export const LeadCardMenu = ({ leadId, name, url, customDomain }: Props) => {
  const [buying, setBuying] = useState(false);

  // The bought domain wins wherever there is one. It is the address a client
  // was given, and the subdomain underneath it is scaffolding.
  const live = customDomain ? `https://${customDomain}` : url;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(live);
      toast.success("Link copied");
    } catch {
      // A clipboard refused by the browser — an insecure origin, or a
      // permission denied. Nothing is broken; the link is on the card.
      toast.error("Could not copy that — the link is on the back of the card");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${name}`}
            className={cn(
              "pointer-events-auto absolute top-2.5 right-2.5 z-20 flex size-8 items-center justify-center rounded-lg",
              "bg-background/70 ring-border/70 text-foreground/70 ring-1 backdrop-blur-md",
              "transition-all duration-200 hover:bg-background hover:text-foreground",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              // Hidden until the card is under the cursor, the same as the
              // hustle cards. Touch has no hover to reveal it, so below md it
              // simply stays.
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              "data-[state=open]:opacity-100 max-md:opacity-100",
            )}
          >
            <DotsThreeIcon className="size-5" weight="bold" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <a href={live} target="_blank" rel="noreferrer noopener">
              <ArrowSquareOutIcon className="size-4" weight="light" />
              Open site
            </a>
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => void copy()}>
            <LinkIcon className="size-4" weight="light" />
            Copy link
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {customDomain ? (
            // Nothing to buy, so the row becomes the answer instead of an
            // action. A menu that still says "add a domain" under a business
            // that has one reads as though the purchase did not work.
            <DropdownMenuItem disabled>
              <GlobeIcon className="size-4" weight="light" />
              <span className="truncate">{customDomain}</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setBuying(true)}>
              <GlobeIcon className="size-4" weight="light" />
              Add a domain
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <BuyDomainDialog
        open={buying}
        onOpenChange={setBuying}
        leadId={leadId}
        name={name}
        currentUrl={url}
      />
    </>
  );
};
