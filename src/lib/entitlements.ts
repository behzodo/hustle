// Clerk billing features that grant each generation limit. Checked instead
// of plan names so entitlements can move between plans without code changes.
export const PRO_FEATURE = "generations_100";
export const MAX_FEATURE = "generations_1000";

// Monthly generation credits per tier. Kept here rather than in usage.ts
// so client components can render them without pulling in Prisma.
export const FREE_POINTS = 2;
export const PRO_POINTS = 100;
export const MAX_POINTS = 1000;

type HasFn = (params: { feature: string }) => boolean;

/** Monthly credits the current user is entitled to, highest tier wins. */
export const creditsFor = (has?: HasFn | null) => {
  if (has?.({ feature: MAX_FEATURE })) return MAX_POINTS;
  if (has?.({ feature: PRO_FEATURE })) return PRO_POINTS;
  return FREE_POINTS;
};

/** True on any paid tier — used to hide upgrade prompts. */
export const isPaidPlan = (has?: HasFn | null) =>
  !!has?.({ feature: PRO_FEATURE }) || !!has?.({ feature: MAX_FEATURE });
