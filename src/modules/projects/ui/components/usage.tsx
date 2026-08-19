import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { CrownIcon } from "lucide-react";
import { formatDuration, intervalToDuration } from "date-fns";

import { Button } from "@/components/ui/button";
import { formatCredits, isPaidPlan } from "@/lib/pricing";

interface Props {
  points: number;
  msBeforeNext: number;
  /**
   * Purchased credits inside `points`. Optional: the dashboard tiles still
   * read the older `credits.status`, which cannot tell the two apart.
   */
  packs?: number;
};

export const Usage = ({ points, msBeforeNext, packs = 0 }: Props) => {
  const { has } = useAuth();
  const hasProAccess = isPaidPlan(has);

  const resetTime = useMemo(() => {
    try {
      return formatDuration(
        intervalToDuration({
          start: new Date(),
          end: new Date(Date.now() + msBeforeNext),
        }),
        { format: ["months", "days", "hours"] }
      )
    } catch (error) {
      console.error("Error formatting duration ", error);
      return "unknown";
    }
  }, [msBeforeNext]);

  // Only the plan's share comes back on the reset date, so saying "resets in
  // nine days" over a balance that is mostly bought credits is a lie in the
  // direction that costs somebody money. When the packs are the whole of it,
  // say the true thing instead: nothing here expires.
  const planCredits = Math.max(0, points - packs);

  return (
    <div className="rounded-t-xl bg-background border border-b-0 p-2.5">
      <div className="flex items-center gap-x-2">
        <div>
          <p className="text-sm">
            {formatCredits(points)} {hasProAccess ? "" : "free "}credits left
          </p>
          <p className="text-xs text-muted-foreground">
            {planCredits === 0
              ? "Bought credits — these do not expire"
              : `Resets in ${resetTime}`}
            {packs > 0 && planCredits > 0
              ? ` · ${formatCredits(packs)} bought`
              : null}
          </p>
        </div>
        {!hasProAccess && (
          <Button
            asChild
            size="sm"
            variant="tertiary"
            className="ml-auto"
          >
            <Link href="/pricing">
              <CrownIcon /> Upgrade
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
};
