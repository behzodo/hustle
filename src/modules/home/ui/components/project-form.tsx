"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import TextareaAutosize from "react-textarea-autosize";
import { generateSlug } from "random-word-slugs";
import { ConvexError } from "convex/values";
import { useMutation } from "convex/react";

import { cn } from "@/lib/utils";
import { api } from "@/../convex/_generated/api";
import { startAgentRun } from "@/modules/projects/start-run";
import { Form, FormField } from "@/components/ui/form";
import { SendButton } from "@/components/send-button";
import { BorderBeam } from "@/components/ui/border-beam";
import { useClerkAppearance } from "@/lib/clerk-appearance";

import { ProjectTemplates } from "./project-templates";

const formSchema = z.object({
  value: z.string()
    .min(1, { message: "Value is required" })
    .max(10000, { message: "Value is too long" }),
})

export const ProjectForm = () => {
  const router = useRouter();
  const clerk = useClerk();
  const appearance = useClerkAppearance();
  const createProject = useMutation(api.projects.create);
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
      // The project name was generated server-side under tRPC; a Convex
      // mutation has to stay deterministic, so the slug is minted here and
      // passed in.
      const projectId = await createProject({
        name: generateSlug(2, { format: "kebab" }),
        value: values.value,
      });

      // Mutations cannot make network calls, so the run is dispatched after
      // the write lands rather than inside it.
      await startAgentRun({ projectId, value: values.value });

      router.push(`/projects/${projectId}`);
    } catch (error) {
      const data = error instanceof ConvexError ? error.data : null;
      const code = (data as { code?: string } | null)?.code;

      if (code === "OUT_OF_CREDITS") {
        toast.error("You have run out of credits");
        router.push("/pricing");
      } else if (code === "UNAUTHENTICATED") {
        clerk.openSignIn({ appearance });
      } else {
        toast.error("Could not start that build");
      }
    } finally {
      setIsPending(false);
    }
  };

  const onSelect = (value: string) => {
    form.setValue("value", value, {
      shouldDirty: true,
      shouldValidate: true,
      shouldTouch: true,
    });
  };
  
  const [isFocused, setIsFocused] = useState(false);
    const isButtonDisabled = isPending || !form.formState.isValid;

  return (
    <Form {...form}>
      <section className="space-y-6">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            "relative overflow-hidden border p-4 pt-1 rounded-xl bg-sidebar dark:bg-sidebar transition-all",
            isFocused && "shadow-xs",
          )}
        >
          {/* Colours come from the theme tokens rather than the component's
              orange/purple defaults, so the beam inverts with the palette:
              a dark sweep on the light theme, a bright one on the dark.
              motion-reduce:hidden drops it for anyone who asked for less. */}
          <BorderBeam
            size={70}
            duration={8}
            borderWidth={1.5}
            colorFrom="var(--primary)"
            colorTo="var(--muted-foreground)"
            className="motion-reduce:hidden"
          />
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
                placeholder="Name the business and what they do — a dentist in Leeds, a barber on Main Street…"
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
            <SendButton disabled={isButtonDisabled} pending={isPending} />
          </div>
        </form>
        <ProjectTemplates onSelect={onSelect} disabled={isPending} />
      </section>
    </Form>
  );
};
