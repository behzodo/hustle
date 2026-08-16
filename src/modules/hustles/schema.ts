import { z } from "zod";

import { POLYGON_MAX_POINTS, RADIUS_MAX_M, RADIUS_MIN_M } from "./area";

// Mirrors the bounds convex/projects.ts enforces on createDraft. Kept in sync
// by hand: the Convex validators cannot express a length, so the server does
// its own check and this only exists to catch it before a round trip.
export const NAME_MIN = 2;
export const NAME_MAX = 60;

export const newHustleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(NAME_MIN, { message: `At least ${NAME_MIN} characters.` })
    .max(NAME_MAX, { message: `Keep it under ${NAME_MAX} characters.` }),
});

export type NewHustleValues = z.infer<typeof newHustleSchema>;

/**
 * The picked area, checked before it is sent.
 *
 * The map cannot really produce a bad one, but the same shape is what the
 * mutation accepts, and `v.number()` on the Convex side will happily take
 * NaN — so both ends check.
 */
const latLngSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

export const hustleAreaSchema = latLngSchema.extend({
  label: z.string().trim().min(1).max(160),
  radiusM: z.number().finite().min(RADIUS_MIN_M).max(RADIUS_MAX_M),
  polygon: z.array(latLngSchema).min(3).max(POLYGON_MAX_POINTS).optional(),
});
