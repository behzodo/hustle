"use client";

import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2Icon, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { RippleButton } from "@/components/ui/ripple-button";
import { MultiStepLoader } from "@/components/ui/multi-step-loader";
import { SlicedWaves } from "@/components/ui/sliced-waves";

import type { HustleArea } from "../../area";
import { HustleSummary } from "../components/hustle-summary";
import { suggestHustleNames } from "../../hustle-names";
import {
  hustleAreaSchema,
  newHustleSchema,
  NAME_MAX,
  type NewHustleValues,
} from "../../schema";

// Mapbox GL reaches for `window` as it initialises, so it must never be part
// of the server render.
const AreaMap = dynamic(
  () => import("../components/area-map").then((mod) => mod.AreaMap),
  {
    ssr: false,
    loading: () => (
      <div className="bg-muted/40 h-[440px] w-full animate-pulse rounded-2xl md:h-[600px]" />
    ),
  },
);

/**
 * Written as a list rather than hardcoded screens because the remaining
 * questions (which trade, how many sites) are the point of the wizard; adding
 * one should mean appending an entry and a branch, not restructuring the
 * progress bar and the buttons around it.
 */
const STEPS = [
  {
    title: "Name this hustle",
    blurb:
      "A hustle is a run of sites — one town, one trade, one push. The name is how you find it again.",
  },
  {
    title: "Where are you hunting?",
    blurb:
      "Draw round the patch, or drop a pin and set how far to look. This is where we search for businesses with no website.",
  },
  {
    title: "Ready to go",
    blurb:
      "This is your hustle. Create it and the next thing you do is describe a business for the agent to build.",
  },
] as const;

/**
 * What the screen says while the hustle is being made.
 *
 * Only the first line is a real unit of work — the write saves the name and
 * the patch together, and the last is the navigation. Kept as three because
 * they are the three things someone would want confirmed, and because the
 * lead search that will genuinely sit in the middle here is next.
 */
const CREATE_STEPS = [
  { text: "Naming your hustle" },
  { text: "Marking out your patch" },
  { text: "Opening your workspace" },
] as const;

const CREATE_STEP_MS = 900;
const CREATE_STEPS_MS = CREATE_STEPS.length * CREATE_STEP_MS;

export const NewHustleView = () => {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  // Separate from `saving`: the overlay stays up through the navigation, so
  // it must not be cleared the moment the mutation resolves.
  const [creating, setCreating] = useState(false);
  const [seed, setSeed] = useState(0);

  // Kept outside react-hook-form: the map is not a field being typed into,
  // and threading a Controller through it buys nothing over one useState.
  const [area, setArea] = useState<HustleArea | null>(null);
  const [areaError, setAreaError] = useState<string | null>(null);

  // The city and trades from onboarding are what a hustle name is made of,
  // so the suggestions are theirs rather than generic.
  const profile = useQuery(api.profiles.status);
  const createDraft = useMutation(api.projects.createDraft);

  const suggestions = useMemo(
    () => suggestHustleNames(profile, seed),
    [profile, seed],
  );

  const form = useForm<NewHustleValues>({
    resolver: zodResolver(newHustleSchema),
    mode: "onChange",
    defaultValues: { name: "" },
  });

  const isLast = step === STEPS.length - 1;

  const onNext = async () => {
    if (step === 0) {
      if (!(await form.trigger("name"))) return;
      setStep(1);
      return;
    }

    const picked = hustleAreaSchema.safeParse(area);

    if (!picked.success) {
      setAreaError("Pick a spot on the map first.");
      return;
    }

    setAreaError(null);

    // The patch is set; show it back before anything is created.
    if (step === 1) {
      setStep(2);
      return;
    }

    await form.handleSubmit(async (values) => {
      setSaving(true);
      setCreating(true);

      const startedAt = Date.now();

      try {
        const projectId = await createDraft({
          name: values.name,
          area: picked.data,
        });

        // The write itself takes a couple of hundred milliseconds, so without
        // this the loader would flash rather than read. Held to the length of
        // the sequence, then the workspace opens under it.
        const elapsed = Date.now() - startedAt;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, CREATE_STEPS_MS - elapsed)),
        );

        // Straight into the hustle: the draft has no messages yet, so the
        // composer there is the wizard's real last step.
        router.push(`/projects/${projectId}`);
      } catch (error) {
        setSaving(false);
        setCreating(false);

        const data = error instanceof ConvexError ? error.data : null;
        const code = (data as { code?: string } | null)?.code;

        toast.error(
          code === "INVALID_NAME"
            ? "That name will not work. Try a shorter one."
            : code === "INVALID_AREA"
              ? "That area will not work. Pick the spot again."
              : "Could not create that hustle",
        );
      }
    })();
  };

  return (
    <div className="relative flex-1">
      {/* Takes the whole screen while the hustle is written, and stays up
          through the navigation so the wizard is never seen again behind it.
          `loop` off — this runs once and stops on the last line. */}
      <MultiStepLoader
        loading={creating}
        loop={false}
        duration={CREATE_STEP_MS}
        loadingStates={[...CREATE_STEPS]}
      />

      {/* Decorative only, so it is hidden from screen readers. The wash on top
          is what keeps the copy readable — the bars alone are too busy behind
          small text, and dimming the shader instead would just make it mud. */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <SlicedWaves
          rows={9}
          columns={13}
          speed={0.22}
          opacity={0.4}
          glow={0.12}
          barThickness={0.08}
          softness={0.07}
          grainIntensity={0.04}
          color1="#f0b49a"
          color2="#2b2b2b"
          color3="#8a8a8a"
        />
        <div className="from-background/30 via-background/70 to-background pointer-events-none absolute inset-0 bg-gradient-to-b" />
      </div>

      <div
        className={cn(
          "relative mx-auto w-full p-4 transition-[max-width] duration-300 md:p-6",
          // The map wants the room, and the headroom: a tall panel plus the
          // usual top margin would open the step already scrolled. The summary
          // sits between the two — wide enough for the map picture, narrow
          // enough that the rows stay readable.
          step === 1
            ? "max-w-5xl md:pt-6"
            : step === 2
              ? "max-w-4xl md:pt-6"
              : "max-w-xl md:pt-12",
        )}
      >
        <div className="mb-8">
          <p className="eyebrow text-primary mb-3 font-medium tabular-nums">
            Step {step + 1} of {STEPS.length}
          </p>
          <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <h1 className="headline-display font-display text-3xl leading-[1.02] tracking-[-0.03em] text-balance md:text-4xl">
          {STEPS[step].title}
        </h1>
        <p className="deck font-display text-muted-foreground mt-3 text-lg leading-[1.45] text-balance">
          {STEPS[step].blurb}
        </p>

        <Form {...form}>
          <form
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault();
              onNext();
            }}
          >
            {step === 0 && (
              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <div>
                    <Input
                      {...field}
                      autoFocus
                      maxLength={NAME_MAX}
                      disabled={saving}
                      placeholder="Leeds dentists"
                      className="font-display h-14 rounded-xl px-4 text-lg md:text-xl"
                    />

                    {fieldState.error?.message && (
                      <p className="text-destructive mt-2 text-sm">
                        {fieldState.error.message}
                      </p>
                    )}

                    {/* Suggestions fill the field rather than submitting: the
                      point is a starting name you then edit, and a chip that
                      created the hustle outright would be a one-click
                      mistake with no undo. */}
                    <div className="mt-5">
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <p className="text-muted-foreground text-sm">
                          Based on where and who you sell to
                        </p>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setSeed((current) => current + 1)}
                          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1.5 text-sm transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className="size-3.5" /> Show me more
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              field.onChange(suggestion.slice(0, NAME_MAX))
                            }
                            className={cn(
                              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                              field.value === suggestion
                                ? "border-primary bg-primary/10"
                                : "hover:bg-muted/50",
                              saving && "cursor-not-allowed opacity-50",
                            )}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-muted-foreground mt-5 text-sm">
                      Only you see this. Rename it whenever you like.
                    </p>
                  </div>
                )}
              />
            )}

            {step === 1 && (
              <div>
                <AreaMap
                  value={area}
                  disabled={saving}
                  // The town from onboarding is nearly always the right place to
                  // open on, so the map starts there instead of over the ocean.
                  initialQuery={profile?.city}
                  onChange={(next) => {
                    setArea(next);
                    setAreaError(null);
                  }}
                />

                {areaError && (
                  <p className="text-destructive mt-3 text-sm">{areaError}</p>
                )}

                <p className="text-muted-foreground mt-5 text-sm">
                  You can change the patch later.
                </p>
              </div>
            )}

            {step === 2 && area && (
              <HustleSummary
                name={form.getValues("name")}
                area={area}
                disabled={saving}
                onEdit={setStep}
              />
            )}

            <div className="mt-10 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() =>
                  step > 0
                    ? setStep((current) => current - 1)
                    : router.push("/hustles")
                }
                className="h-11 rounded-xl px-5 text-sm font-medium tracking-tight"
              >
                {step > 0 ? "Back" : "Cancel"}
              </Button>

              <RippleButton
                type="submit"
                disabled={saving}
                rippleColor="#f0b49a"
                className={cn(
                  "bg-primary text-primary-foreground border-none",
                  "h-11 rounded-xl px-6 text-sm font-medium tracking-tight",
                  "hover:bg-primary/90 transition-colors",
                  "disabled:pointer-events-none disabled:opacity-60",
                )}
              >
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  {saving ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" /> Creating
                    </>
                  ) : isLast ? (
                    <>
                      Create hustle <ArrowRight className="size-4" />
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="size-4" />
                    </>
                  )}
                </span>
              </RippleButton>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};
