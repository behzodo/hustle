"use client";

import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/../convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { RippleButton } from "@/components/ui/ripple-button";

import { onboardingSchema, type OnboardingValues } from "../schema";
import {
  ONBOARDING_EXPERIENCE,
  ONBOARDING_INDUSTRIES,
  ONBOARDING_PRICE_BANDS,
  ONBOARDING_TONE,
  ONBOARDING_MAX_INDUSTRIES,
} from "../constants";

// Which fields each step owns, so Next only validates what is on screen.
const STEPS = [
  {
    title: "Who's doing the selling?",
    blurb: "This signs every pitch and sits on the sites you send.",
    fields: ["tradingName", "experience"],
  },
  {
    title: "Where do you sell?",
    blurb: "We look for businesses here first.",
    fields: ["city"],
  },
  {
    title: "Who are you after?",
    blurb: `Pick up to ${ONBOARDING_MAX_INDUSTRIES}. You can change this later.`,
    fields: ["industries"],
  },
  {
    title: "How do you pitch?",
    blurb: "Sets the price you anchor to and how the writing sounds.",
    fields: ["priceBand", "tone"],
  },
] as const satisfies ReadonlyArray<{
  title: string;
  blurb: string;
  fields: ReadonlyArray<keyof OnboardingValues>;
}>;

interface ChoiceProps {
  selected: boolean;
  disabled?: boolean;
  emoji?: string;
  label: string;
  hint?: string;
  onSelect: () => void;
};

// Every pick-one and pick-many step renders the same card, so selection
// looks identical whether the field is a string or an array.
const Choice = ({ selected, disabled, emoji, label, hint, onSelect }: ChoiceProps) => (
  <button
    type="button"
    aria-pressed={selected}
    disabled={disabled}
    onClick={onSelect}
    className={cn(
      "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
      selected ? "border-primary bg-primary/10" : "hover:bg-muted/50",
      disabled && "cursor-not-allowed opacity-40"
    )}
  >
    {emoji && (
      <span aria-hidden="true" className="text-lg leading-none">
        {emoji}
      </span>
    )}
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium">{label}</span>
      {hint && (
        <span className="text-muted-foreground block text-xs">{hint}</span>
      )}
    </span>
    {selected && <Check className="text-primary size-4 shrink-0" />}
  </button>
);

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-destructive mt-2 text-sm">{message}</p> : null;

interface Props {
  /** Prefilled when someone reopens the wizard to change their setup. */
  defaultValues?: Partial<OnboardingValues>;
};

export const OnboardingWizard = ({ defaultValues }: Props) => {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const saveProfile = useMutation(api.profiles.save);

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    mode: "onChange",
    defaultValues: {
      tradingName: defaultValues?.tradingName ?? "",
      experience: defaultValues?.experience ?? "",
      city: defaultValues?.city ?? "",
      industries: defaultValues?.industries ?? [],
      priceBand: defaultValues?.priceBand ?? "",
      tone: defaultValues?.tone ?? "",
    },
  });

  const isLast = step === STEPS.length - 1;

  const onNext = async () => {
    const valid = await form.trigger(
      STEPS[step].fields as unknown as (keyof OnboardingValues)[]
    );

    if (!valid) return;

    if (!isLast) {
      setStep((current) => current + 1);
      return;
    }

    await form.handleSubmit(async (values) => {
      setSaving(true);

      try {
        await saveProfile(values);
        // Refresh first so the server guard re-runs and sees the new
        // profile; pushing before it would bounce straight back here.
        router.refresh();
        router.push("/connections");
      } catch {
        setSaving(false);
        toast.error("Could not save your setup. Try again.");
      }
    })();
  };

  return (
    <div className="w-full max-w-xl">
      {/* Progress: a step counter plus a bar, so the end is always visible. */}
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

      {/* Same setting as the landing and workspace headings: display face,
          tight tracking, with the deck in the same family at text optical
          size so the two lines read as one voice. */}
      <h1 className="headline-display font-display text-balance text-3xl leading-[1.02] tracking-[-0.03em] md:text-4xl">
        {STEPS[step].title}
      </h1>
      <p className="deck font-display text-muted-foreground mt-3 text-balance text-lg leading-[1.45]">
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
            <div className="space-y-8">
              <FormField
                control={form.control}
                name="tradingName"
                render={({ field, fieldState }) => (
                  <div>
                    <Input
                      {...field}
                      autoFocus
                      placeholder="Your name, or your studio's"
                      className="font-display h-14 rounded-xl px-4 text-lg md:text-xl"
                    />
                    <p className="text-muted-foreground mt-2.5 text-sm">
                      Whatever a stranger should see at the bottom of the email.
                    </p>
                    <FieldError message={fieldState.error?.message} />
                  </div>
                )}
              />

              <FormField
                control={form.control}
                name="experience"
                render={({ field, fieldState }) => (
                  <div>
                    <p className="deck font-display mb-4 text-lg leading-[1.45]">
                      Sold a website before?
                    </p>
                    <div className="grid gap-2">
                      {ONBOARDING_EXPERIENCE.map((option) => (
                        <Choice
                          key={option.value}
                          selected={field.value === option.value}
                          emoji={option.emoji}
                          label={option.label}
                          hint={option.hint}
                          onSelect={() => field.onChange(option.value)}
                        />
                      ))}
                    </div>
                    <FieldError message={fieldState.error?.message} />
                  </div>
                )}
              />
            </div>
          )}

          {step === 1 && (
            <FormField
              control={form.control}
              name="city"
              render={({ field, fieldState }) => (
                <div>
                  {/* Set in the display face too — at this size it reads as
                      part of the question rather than a form control. */}
                  <Input
                    {...field}
                    autoFocus
                    placeholder="Manchester, UK"
                    className="font-display h-14 rounded-xl px-4 text-lg md:text-xl"
                  />
                  <p className="text-muted-foreground mt-2.5 text-sm">
                    A town or city works better than a whole country.
                  </p>
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />
          )}

          {step === 2 && (
            <FormField
              control={form.control}
              name="industries"
              render={({ field, fieldState }) => {
                const selected = field.value ?? [];
                const atLimit = selected.length >= ONBOARDING_MAX_INDUSTRIES;

                return (
                  <div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ONBOARDING_INDUSTRIES.map((industry) => {
                        const isOn = selected.includes(industry.value);

                        return (
                          <Choice
                            key={industry.value}
                            selected={isOn}
                            // Only block adding; deselecting must always work.
                            disabled={!isOn && atLimit}
                            emoji={industry.emoji}
                            label={industry.label}
                            hint={industry.hint}
                            onSelect={() =>
                              field.onChange(
                                isOn
                                  ? selected.filter((v) => v !== industry.value)
                                  : [...selected, industry.value]
                              )
                            }
                          />
                        );
                      })}
                    </div>
                    <p className="text-muted-foreground mt-3 text-xs tabular-nums">
                      {selected.length} of {ONBOARDING_MAX_INDUSTRIES} selected
                    </p>
                    <FieldError message={fieldState.error?.message} />
                  </div>
                );
              }}
            />
          )}

          {step === 3 && (
            <div className="space-y-8">
              <FormField
                control={form.control}
                name="priceBand"
                render={({ field, fieldState }) => (
                  <div>
                    <p className="deck font-display mb-4 text-lg leading-[1.45]">
                      What do you charge for a site?
                    </p>
                    <div className="grid gap-2">
                      {ONBOARDING_PRICE_BANDS.map((band) => (
                        <Choice
                          key={band.value}
                          selected={field.value === band.value}
                          label={band.label}
                          hint={band.hint}
                          onSelect={() => field.onChange(band.value)}
                        />
                      ))}
                    </div>
                    <FieldError message={fieldState.error?.message} />
                  </div>
                )}
              />

              <FormField
                control={form.control}
                name="tone"
                render={({ field, fieldState }) => (
                  <div>
                    <p className="deck font-display mb-4 text-lg leading-[1.45]">
                      How should it sound?
                    </p>
                    <div className="grid gap-2">
                      {ONBOARDING_TONE.map((option) => (
                        <Choice
                          key={option.value}
                          selected={field.value === option.value}
                          emoji={option.emoji}
                          label={option.label}
                          hint={option.hint}
                          onSelect={() => field.onChange(option.value)}
                        />
                      ))}
                    </div>
                    <FieldError message={fieldState.error?.message} />
                  </div>
                )}
              />
            </div>
          )}

          {/* justify-between with a spacer, rather than ml-auto on the
              button: the alignment is left to the container so it cannot be
              overridden by the button component's own styles. */}
          <div className="mt-10 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setStep((current) => current - 1)}
                className="h-11 rounded-xl px-5 text-sm font-medium tracking-tight"
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
            ) : (
              // Holds the left slot on step one so Continue stays right.
              <span aria-hidden="true" />
            )}

            {/* RippleButton sets no type scale of its own, so it inherited
                16px/normal and sat a size apart from Back. Both are pinned
                to the same height and text style here. */}
            <RippleButton
              type="submit"
              disabled={saving}
              rippleColor="#f0b49a"
              className={cn(
                "bg-primary text-primary-foreground border-none",
                "h-11 rounded-xl px-6 text-sm font-medium tracking-tight",
                "transition-colors hover:bg-primary/90",
                "disabled:pointer-events-none disabled:opacity-60"
              )}
            >
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                {saving ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" /> Saving
                  </>
                ) : isLast ? (
                  <>Start hustling <ArrowRight className="size-4" /></>
                ) : (
                  <>Continue <ArrowRight className="size-4" /></>
                )}
              </span>
            </RippleButton>
          </div>
        </form>
      </Form>
    </div>
  );
};
