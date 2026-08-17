"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { DotsThreeIcon, TrashIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  id: Id<"projects">;
  name: string;
}

/**
 * Per-card actions, sitting on the cover.
 *
 * Rendered as a sibling of the card's link rather than inside it: a button
 * nested in an anchor navigates on click no matter what the handler does, so
 * the two have to be separate elements stacked over the same corner.
 */
export const HustleCardMenu = ({ id, name }: Props) => {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useMutation(api.projects.remove);

  const onDelete = async () => {
    setDeleting(true);

    try {
      await remove({ projectId: id });
      // No cleanup on the way out: the row leaves the list the moment the
      // mutation lands, so this component is already gone.
      toast.success(`Deleted "${name}"`);
    } catch (error) {
      setDeleting(false);

      const data = error instanceof ConvexError ? error.data : null;
      const code = (data as { code?: string } | null)?.code;

      toast.error(
        code === "NOT_FOUND"
          ? "That hustle is already gone."
          : "Could not delete that hustle",
      );
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
              "pointer-events-auto absolute top-2.5 right-2.5 z-10 flex size-8 items-center justify-center rounded-lg",
              "bg-background/70 ring-border/70 text-foreground/70 ring-1 backdrop-blur-md",
              "transition-all duration-200 hover:bg-background hover:text-foreground",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              // Hidden until the card is under the cursor on pointer devices.
              // Touch has no hover to reveal it, so below md it simply stays.
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              "data-[state=open]:opacity-100 max-md:opacity-100",
            )}
          >
            <DotsThreeIcon className="size-5" weight="bold" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirming(true)}
          >
            <TrashIcon className="size-4" weight="light" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmed rather than undoable: the delete cascades through every
          message and fragment under the hustle, so there is nothing left to
          restore afterwards. */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              The site and every message in this hustle go with it. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              // The dialog closes itself on action by default, which would
              // hide the pending state before the mutation resolves.
              onClick={(event) => {
                event.preventDefault();
                onDelete();
              }}
            >
              {deleting ? "Deleting" : "Delete hustle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
