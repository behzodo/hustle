import { z } from "zod";

import {
  EXPERIENCE_VALUES,
  INDUSTRY_VALUES,
  PRICE_BAND_VALUES,
  TONE_VALUES,
  ONBOARDING_MAX_INDUSTRIES,
} from "./constants";

// One schema for the form resolver and the tRPC input, so client-side
// validation and server-side validation cannot disagree.
export const onboardingSchema = z.object({
  tradingName: z
    .string()
    .trim()
    .min(2, { message: "We need a name to sign your pitches with" })
    .max(60, { message: "Keep it short enough to sign an email" }),
  experience: z
    .string()
    .refine((value) => EXPERIENCE_VALUES.includes(value), {
      message: "Pick where you are up to",
    }),
  city: z
    .string()
    .trim()
    .min(2, { message: "Tell us the town or city you sell in" })
    .max(120, { message: "That is too long for a place name" }),
  industries: z
    .array(z.string())
    .min(1, { message: "Pick at least one type of business" })
    .max(ONBOARDING_MAX_INDUSTRIES, {
      message: `Pick up to ${ONBOARDING_MAX_INDUSTRIES} to start`,
    })
    .refine((values) => values.every((v) => INDUSTRY_VALUES.includes(v)), {
      message: "Unknown industry",
    }),
  priceBand: z
    .string()
    .refine((value) => PRICE_BAND_VALUES.includes(value), {
      message: "Choose what you typically charge",
    }),
  tone: z
    .string()
    .refine((value) => TONE_VALUES.includes(value), {
      message: "Pick how you want to come across",
    }),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;
