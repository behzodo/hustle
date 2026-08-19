import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";
import { ConvexError } from "convex/values";
import { useMutation, useQuery } from "convex/react";

import { cn } from "@/lib/utils";
import { api } from "@/../convex/_generated/api";
import type { ProjectId } from "@/modules/projects/types";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";

import { startAgentRun } from "@/modules/projects/start-run";

import { Usage } from "./usage";

interface Props {
  projectId: ProjectId;
};

const formSchema = z.object({
  value: z.string()
    .min(1, { message: "Value is required" })
    .max(10000, { message: "Value is too long" }),
})

export const MessageForm = ({ projectId }: Props) => {
  const router = useRouter();

  // Reactive, so spending a credit updates the counter in every open tab.
  // The tRPC version needed an explicit invalidate after each send.
  //
  // `balance` rather than `status`: this panel sits above the box that spends
  // them, so it is the one place worth telling a plan credit from a bought
  // one — only half of what is shown here comes back on the reset date.
  const usage = useQuery(api.credits.balance);
  const sendMessage = useMutation(api.messages.send);
  const [isPending, setIsPending] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: "",
    },
  });
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsPending(true);

    try {
      await sendMessage({ projectId, value: values.value });
      form.reset();

      // The message list is a live query, so there is nothing to invalidate —
      // the new row arrives on its own.
      await startAgentRun({ projectId, value: values.value });
    } catch (error) {
      // Credits throw a ConvexError carrying a code; anything else is a
      // genuine failure and should not send someone to the pricing page.
      const data = error instanceof ConvexError ? error.data : null;
      const code = (data as { code?: string } | null)?.code;

      if (code === "OUT_OF_CREDITS") {
        toast.error("You have run out of credits");
        router.push("/pricing");
      } else {
        toast.error("Could not send that message");
      }
    } finally {
      setIsPending(false);
    }
  };

  const [isFocused, setIsFocused] = useState(false);
  const isButtonDisabled = isPending || !form.formState.isValid;
  const showUsage = Boolean(usage);

  return (
    <Form {...form}>
      {showUsage && (
        <Usage
          points={usage!.total}
          msBeforeNext={usage!.msBeforeReset}
          packs={usage!.packs}
        />
      )}
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn(
          "relative border p-4 pt-1 rounded-xl bg-sidebar dark:bg-sidebar transition-all",
          isFocused && "shadow-xs",
          showUsage && "rounded-t-none",
        )}
      >
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <TextareaAutosize
              {...field}
              disabled={isPending}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              minRows={2}
              maxRows={8}
              className="pt-4 resize-none border-none w-full outline-none bg-transparent"
              placeholder="What would you like to build?"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  form.handleSubmit(onSubmit)(e);
                }
              }}
            />
          )}
        />
        <div className="flex gap-x-2 items-end justify-between pt-2">
          <div className="text-[10px] text-muted-foreground font-mono">
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span>&#8984;</span>Enter
            </kbd>
            &nbsp;to submit
          </div>
          <Button
            disabled={isButtonDisabled}
            className={cn(
              "size-8 rounded-full",
              isButtonDisabled && "bg-muted-foreground border"
            )}
          >
            {isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <ArrowUpIcon />
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};
